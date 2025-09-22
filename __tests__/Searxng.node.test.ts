import { IExecuteFunctions } from 'n8n-workflow';
import { Searxng } from '../nodes/Searxng/Searxng.node';
import nock from 'nock';

// Mock the n8n workflow module
jest.mock('n8n-workflow', () => {
  const original = jest.requireActual('n8n-workflow');
  return {
    ...original,
    NodeOperationError: jest.fn().mockImplementation((node, message) => {
      return { message };
    }),
  };
});

describe('Searxng', () => {
  let searxng: Searxng;
  let mockExecuteFunction: IExecuteFunctions;

  beforeAll(() => {
    // Disable real HTTP requests
    nock.disableNetConnect();
  });

  afterAll(() => {
    // Enable real HTTP requests
    nock.enableNetConnect();
    jest.clearAllMocks();
  });

  beforeEach(() => {
    searxng = new Searxng();
    
    // Mock execute functions
    mockExecuteFunction = {
      getInputData: jest.fn().mockReturnValue([{ json: {} }]),
      getNodeParameter: jest.fn(),
      getCredentials: jest.fn(),
      helpers: {
        httpRequest: jest.fn(),
      },
      continueOnFail: jest.fn().mockReturnValue(false),
      getNode: jest.fn().mockReturnValue({ name: 'Searxng' }),
    } as unknown as IExecuteFunctions;
  });

  afterEach(() => {
    jest.clearAllMocks();
    nock.cleanAll();
  });

  describe('description', () => {
    it('should have the correct properties', () => {
      expect(searxng.description).toBeDefined();
      expect(searxng.description.name).toBe('searxng');
      expect(searxng.description.displayName).toBe('Searxng');
      expect(searxng.description.version).toBe(1);
      expect(searxng.description.group).toContain('transform');
      expect(searxng.description.usableAsTool).toBe(true);
    });

    it('should have required credentials', () => {
      const credentials = searxng.description.credentials;
      expect(credentials).toBeDefined();
      if (credentials && credentials.length > 0) {
        expect(credentials[0].name).toBe('searxngApi');
        expect(credentials[0].required).toBe(true);
      }
    });

    it('should have search operation defined', () => {
      const operations = searxng.description.properties.find(prop => prop.name === 'operation');
      expect(operations).toBeDefined();
      if (operations && operations.type === 'options' && operations.options && operations.options.length > 0) {
        const option = operations.options[0] as { value: string };
        expect(option.value).toBe('search');
      }
    });

    it('should have query parameter defined', () => {
      const query = searxng.description.properties.find(prop => prop.name === 'query');
      expect(query).toBeDefined();
      if (query) {
        expect(query.type).toBe('string');
        expect(query.required).toBe(true);
      }
    });

    it('should have categories parameter defined', () => {
      const categories = searxng.description.properties.find(prop => prop.name === 'categories');
      expect(categories).toBeDefined();
      if (categories && categories.type === 'multiOptions' && categories.options) {
        expect(categories.options.length).toBeGreaterThan(0);
      }
    });
  });

  describe('categories parameter handling', () => {
    it('should handle categories as an array of strings', async () => {
      // Setup credentials
      mockExecuteFunction.getCredentials = jest.fn().mockResolvedValue({
        apiUrl: 'https://searxng.example.com',
        apiKey: 'test-api-key',
      });

      // Setup node parameters with categories as array
      mockExecuteFunction.getNodeParameter = jest.fn().mockImplementation((paramName, _) => {
        switch (paramName) {
          case 'query':
            return 'test query';
          case 'categories':
            return ['general', 'it'];
          case 'limit':
            return 10;
          case 'pageno':
            return 0;
          case 'additionalFields':
            return {};
          default:
            return undefined;
        }
      });

      // Mock HTTP response
      mockExecuteFunction.helpers.httpRequest = jest.fn().mockResolvedValue({
        results: [],
        number_of_results: 0
      });

      // Execute the node
      await searxng.execute.call(mockExecuteFunction);

      // Verify categories parameter was correctly processed as comma-separated string
      expect(mockExecuteFunction.helpers.httpRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          qs: expect.objectContaining({
            categories: 'general,it',
          }),
        })
      );
    });

    it('should handle categories as a single string', async () => {
      // Setup credentials
      mockExecuteFunction.getCredentials = jest.fn().mockResolvedValue({
        apiUrl: 'https://searxng.example.com',
        apiKey: 'test-api-key',
      });

      // Setup node parameters with categories as single string
      mockExecuteFunction.getNodeParameter = jest.fn().mockImplementation((paramName, _) => {
        switch (paramName) {
          case 'query':
            return 'test query';
          case 'categories':
            return 'science'; // Single string value
          case 'limit':
            return 10;
          case 'pageno':
            return 0;
          case 'additionalFields':
            return {};
          default:
            return undefined;
        }
      });

      // Mock HTTP response
      mockExecuteFunction.helpers.httpRequest = jest.fn().mockResolvedValue({
        results: [],
        number_of_results: 0
      });

      // Execute the node
      await searxng.execute.call(mockExecuteFunction);

      // Verify categories parameter was correctly processed
      expect(mockExecuteFunction.helpers.httpRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          qs: expect.objectContaining({
            categories: 'science',
          }),
        })
      );
    });

    it('should handle null/undefined categories by defaulting to general', async () => {
      // Setup credentials
      mockExecuteFunction.getCredentials = jest.fn().mockResolvedValue({
        apiUrl: 'https://searxng.example.com',
        apiKey: 'test-api-key',
      });

      // Setup node parameters with null categories
      mockExecuteFunction.getNodeParameter = jest.fn().mockImplementation((paramName, _) => {
        switch (paramName) {
          case 'query':
            return 'test query';
          case 'categories':
            return null; // Null value
          case 'limit':
            return 10;
          case 'pageno':
            return 0;
          case 'additionalFields':
            return {};
          default:
            return undefined;
        }
      });

      // Mock HTTP response
      mockExecuteFunction.helpers.httpRequest = jest.fn().mockResolvedValue({
        results: [],
        number_of_results: 0
      });

      // Execute the node
      await searxng.execute.call(mockExecuteFunction);

      // Verify default categories value was used
      expect(mockExecuteFunction.helpers.httpRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          qs: expect.objectContaining({
            categories: 'general',
          }),
        })
      );
    });
  });

  describe('fields filter functionality', () => {
    it('should handle undefined filter parameter', async () => {
      // Setup credentials
      mockExecuteFunction.getCredentials = jest.fn().mockResolvedValue({
        apiUrl: 'https://searxng.example.com',
        apiKey: 'test-api-key',
      });

      // Setup node parameters with undefined filter
      mockExecuteFunction.getNodeParameter = jest.fn().mockImplementation((paramName, _) => {
        switch (paramName) {
          case 'query':
            return 'test query';
          case 'categories':
            return ['general'];
          case 'limit':
            return 10;
          case 'pageno':
            return 0;
          case 'additionalFields':
            return {
              // No filter parameter
            };
          default:
            return undefined;
        }
      });

      // Setup HTTP response with fields that could be filtered
      const mockResponse = {
        results: [
          {
            title: 'Test Result 1',
            url: 'https://example.com/result1',
            content: 'This is test content 1',
            thumbnail: 'thumbnail1.jpg',
            parsed_url: 'parsed.url.1',
            positions: [1, 2, 3],
          },
        ],
      };

      // Mock the HTTP request
      mockExecuteFunction.helpers.httpRequest = jest.fn().mockResolvedValue(mockResponse);

      // Execute the node
      const result = await searxng.execute.call(mockExecuteFunction);

      // Verify filter wasn't applied (only default fields were removed)
      expect(result[0]).toBeDefined();
      expect(result[0][0].json).toBeDefined();
      expect(result[0][0].json.results).toBeDefined();
      
      const results = result[0][0].json.results as Array<Record<string, any>>;
      expect(results.length).toBeGreaterThan(0);
      
      const resultItem = results[0];
      expect(resultItem.thumbnail).toBeUndefined();
      expect(resultItem.parsed_url).toBeUndefined();
      expect(resultItem.title).toBeDefined();
      expect(resultItem.url).toBeDefined();
      expect(resultItem.content).toBeDefined();
    });

    it('should remove a single field when filter has one value', async () => {
      // Setup credentials
      mockExecuteFunction.getCredentials = jest.fn().mockResolvedValue({
        apiUrl: 'https://searxng.example.com',
        apiKey: 'test-api-key',
      });

      // Setup node parameters with single filter value
      mockExecuteFunction.getNodeParameter = jest.fn().mockImplementation((paramName, _) => {
        switch (paramName) {
          case 'query':
            return 'test query';
          case 'categories':
            return ['general'];
          case 'limit':
            return 10;
          case 'pageno':
            return 0;
          case 'additionalFields':
            return {
              filter: 'title', // Remove title field
            };
          default:
            return undefined;
        }
      });

      // Setup HTTP response with fields that could be filtered
      const mockResponse = {
        results: [
          {
            title: 'Test Result 1',
            url: 'https://example.com/result1',
            content: 'This is test content 1',
            thumbnail: 'thumbnail1.jpg',
            parsed_url: 'parsed.url.1',
            positions: [1, 2, 3],
          },
        ],
      };

      // Mock the HTTP request
      mockExecuteFunction.helpers.httpRequest = jest.fn().mockResolvedValue(mockResponse);

      // Execute the node
      const result = await searxng.execute.call(mockExecuteFunction);

      // Verify title field was removed, along with default fields
      expect(result[0]).toBeDefined();
      expect(result[0][0].json).toBeDefined();
      expect(result[0][0].json.results).toBeDefined();
      
      const results = result[0][0].json.results as Array<Record<string, any>>;
      expect(results.length).toBeGreaterThan(0);
      
      const resultItem = results[0];
      expect(resultItem.title).toBeUndefined();
      expect(resultItem.parsed_url).toBeDefined();
      expect(resultItem.url).toBeDefined();
      expect(resultItem.content).toBeDefined();
    });

    it('should remove multiple fields when filter has multiple values', async () => {
      // Setup credentials
      mockExecuteFunction.getCredentials = jest.fn().mockResolvedValue({
        apiUrl: 'https://searxng.example.com',
        apiKey: 'test-api-key',
      });

      // Setup node parameters with multiple filter values
      mockExecuteFunction.getNodeParameter = jest.fn().mockImplementation((paramName, _) => {
        switch (paramName) {
          case 'query':
            return 'test query';
          case 'categories':
            return ['general'];
          case 'limit':
            return 10;
          case 'pageno':
            return 0;
          case 'additionalFields':
            return {
              filter: 'title,content,positions', // Remove these fields
            };
          default:
            return undefined;
        }
      });

      // Setup HTTP response with fields that could be filtered
      const mockResponse = {
        results: [
          {
            title: 'Test Result 1',
            url: 'https://example.com/result1',
            content: 'This is test content 1',
            thumbnail: 'thumbnail1.jpg',
            parsed_url: 'parsed.url.1',
            positions: [1, 2, 3],
          },
        ],
      };

      // Mock the HTTP request
      mockExecuteFunction.helpers.httpRequest = jest.fn().mockResolvedValue(mockResponse);

      // Execute the node
      const result = await searxng.execute.call(mockExecuteFunction);

      // Verify all specified fields were removed, along with default fields
      expect(result[0]).toBeDefined();
      expect(result[0][0].json).toBeDefined();
      expect(result[0][0].json.results).toBeDefined();
      
      const results = result[0][0].json.results as Array<Record<string, any>>;
      expect(results.length).toBeGreaterThan(0);
      
      const resultItem = results[0];
      expect(resultItem.title).toBeUndefined();
      expect(resultItem.content).toBeUndefined();
      expect(resultItem.positions).toBeUndefined();
      expect(resultItem.parsed_url).toBeDefined();
      expect(resultItem.thumbnail).toBeDefined();
      expect(resultItem.url).toBeDefined();
      expect(resultItem.snippet).toBeDefined(); // Should be created from content before filtering
    });

    it('should handle filter with whitespace in values', async () => {
      // Setup credentials
      mockExecuteFunction.getCredentials = jest.fn().mockResolvedValue({
        apiUrl: 'https://searxng.example.com',
        apiKey: 'test-api-key',
      });

      // Setup node parameters with filter values containing whitespace
      mockExecuteFunction.getNodeParameter = jest.fn().mockImplementation((paramName, _) => {
        switch (paramName) {
          case 'query':
            return 'test query';
          case 'categories':
            return ['general'];
          case 'limit':
            return 10;
          case 'pageno':
            return 0;
          case 'additionalFields':
            return {
              filter: ' title , content ', // Whitespace should be handled
            };
          default:
            return undefined;
        }
      });

      // Setup HTTP response with fields that could be filtered
      const mockResponse = {
        results: [
          {
            title: 'Test Result 1',
            url: 'https://example.com/result1',
            content: 'This is test content 1',
            thumbnail: 'thumbnail1.jpg',
            parsed_url: 'parsed.url.1',
          },
        ],
      };

      // Mock the HTTP request
      mockExecuteFunction.helpers.httpRequest = jest.fn().mockResolvedValue(mockResponse);

      // Execute the node
      const result = await searxng.execute.call(mockExecuteFunction);

      // Verify fields were removed despite whitespace
      expect(result[0]).toBeDefined();
      expect(result[0][0].json).toBeDefined();
      expect(result[0][0].json.results).toBeDefined();
      
      const results = result[0][0].json.results as Array<Record<string, any>>;
      expect(results.length).toBeGreaterThan(0);
      
      const resultItem = results[0];
      expect(resultItem.title).toBeUndefined();
      expect(resultItem.content).toBeUndefined();
      expect(resultItem.thumbnail).toBeDefined();
      expect(resultItem.parsed_url).toBeDefined();
      expect(resultItem.url).toBeDefined();
    });
  });

  describe('execute', () => {
    it('should throw an error if credentials are missing', async () => {
      // Mock the getCredentials to return null
      mockExecuteFunction.getCredentials = jest.fn().mockResolvedValue(null);
      
      // Mock getNode to return a real node for NodeOperationError
      mockExecuteFunction.getNode = jest.fn().mockReturnValue({ 
        name: 'Searxng',
        type: 'n8n-nodes-base.searxng',
        typeVersion: 1,
        position: [0, 0]
      });
      
      // Test that execution throws an error
      try {
        await searxng.execute.call(mockExecuteFunction);
        // If we get here, the function didn't throw, which is a failure
        fail('Expected function to throw but it did not');
      } catch (error) {
        expect(error.message).toBe('No credentials got returned!');
      }
    });
    
    it('should perform a search request with correct parameters', async () => {
      // Setup credentials
      mockExecuteFunction.getCredentials = jest.fn().mockResolvedValue({
        apiUrl: 'https://searxng.example.com',
        apiKey: 'test-api-key',
      });

      // Setup node parameters
      mockExecuteFunction.getNodeParameter = jest.fn().mockImplementation((paramName, _) => {
        switch (paramName) {
          case 'query':
            return 'test query';
          case 'categories':
            return ['general'];
          case 'limit':
            return 10;
          case 'pageno':
            return 0;
          case 'additionalFields':
            return {
              language: 'en',
              format: 'json',
            };
          default:
            return undefined;
        }
      });

      // Setup HTTP response
      const mockResponse = {
        results: [
          {
            title: 'Test Result 1',
            url: 'https://example.com/result1',
            content: 'This is test content 1',
          },
          {
            title: 'Test Result 2',
            url: 'https://example.com/result2',
            content: 'This is test content 2',
          },
        ],
        number_of_results: 2,
        search_time: 0.5,
        engine: 'searxng',
      };

      // Mock the HTTP request
      mockExecuteFunction.helpers.httpRequest = jest.fn().mockResolvedValue(mockResponse);

      // Execute the node
      const result = await searxng.execute.call(mockExecuteFunction);

      // Validate the result
      expect(result).toBeDefined();
      expect(result[0]).toBeDefined();
      expect(result[0][0].json.success).toBe(true);
      expect(result[0][0].json.query).toBe('test query');
      expect(result[0][0].json.results).toHaveLength(2);
      
      // Check metadata if it exists
      const jsonData = result[0][0].json;
      if (jsonData && typeof jsonData === 'object' && 'metadata' in jsonData) {
        const metadata = jsonData.metadata as { total: number };
        expect(metadata.total).toBe(2);
      }
      
      expect(mockExecuteFunction.helpers.httpRequest).toHaveBeenCalledWith({
        method: 'GET',
        url: 'https://searxng.example.com/search',
        qs: expect.objectContaining({
          q: 'test query',
          categories: 'general',
          format: 'json',
          language: 'en',
        }),
        headers: expect.objectContaining({
          Authorization: 'Bearer test-api-key',
        }),
      });
    });

    it('should handle single response mode', async () => {
      // Setup credentials
      mockExecuteFunction.getCredentials = jest.fn().mockResolvedValue({
        apiUrl: 'https://searxng.example.com',
        apiKey: 'test-api-key',
      });

      // Setup node parameters with singleResponse = true
      mockExecuteFunction.getNodeParameter = jest.fn().mockImplementation((paramName, _) => {
        switch (paramName) {
          case 'query':
            return 'test query';
          case 'categories':
            return ['general'];
          case 'limit':
            return 10;
          case 'pageno':
            return 0;
          case 'additionalFields':
            return {
              singleResponse: true
            };
          default:
            return undefined;
        }
      });

      // Setup HTTP response
      const mockResponse = {
        results: [
          {
            title: 'Test Result',
            url: 'https://example.com/result',
            content: 'This is test content',
            snippet: 'This is test snippet',
          },
        ],
      };

      // Mock the HTTP request
      mockExecuteFunction.helpers.httpRequest = jest.fn().mockResolvedValue(mockResponse);

      // Execute the node
      const result = await searxng.execute.call(mockExecuteFunction);

      // Validate the result for single response mode
      expect(result).toBeDefined();
      expect(result[0]).toBeDefined();
      expect(result[0][0].json.success).toBe(true);
      expect(result[0][0].json.query).toBe('test query');
      expect(result[0][0].json.answer).toBe('This is test content');
    });

    it('should handle HTTP request errors gracefully when continueOnFail is true', async () => {
      // Setup credentials
      mockExecuteFunction.getCredentials = jest.fn().mockResolvedValue({
        apiUrl: 'https://searxng.example.com',
        apiKey: 'test-api-key',
      });

      // Setup node parameters
      mockExecuteFunction.getNodeParameter = jest.fn().mockImplementation((paramName, _) => {
        switch (paramName) {
          case 'query':
            return 'test query';
          case 'categories':
            return ['general'];
          case 'limit':
            return 10;
          case 'pageno':
            return 0;
          case 'additionalFields':
            return {};
          default:
            return undefined;
        }
      });

      // Setup HTTP request to throw an error
      mockExecuteFunction.helpers.httpRequest = jest.fn().mockRejectedValue(new Error('API error'));
      
      // Setup continueOnFail to return true
      mockExecuteFunction.continueOnFail = jest.fn().mockReturnValue(true);

      // Execute the node
      const result = await searxng.execute.call(mockExecuteFunction);

      // Validate the error handling
      expect(result).toBeDefined();
      expect(result[0]).toBeDefined();
      expect(result[0][0].json.success).toBe(false);
      expect(result[0][0].json.error).toBe('API error');
      expect(result[0][0].json.query).toBe('test query');
    });
  });
});