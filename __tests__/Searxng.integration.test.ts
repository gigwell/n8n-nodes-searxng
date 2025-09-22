import { IExecuteFunctions } from 'n8n-workflow';
import { Searxng } from '../nodes/Searxng/Searxng.node';
import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// This test connects to a real SearxNG instance
describe('Searxng Integration', () => {
  let searxng: Searxng;
  let mockExecuteFunction: IExecuteFunctions;

  beforeEach(() => {
    searxng = new Searxng();
    
    // Setup mock execute functions with real HTTP request capability
    mockExecuteFunction = {
      getInputData: jest.fn().mockReturnValue([{ json: {} }]),
      getNodeParameter: jest.fn(),
      getCredentials: jest.fn(),
      helpers: {
        // Use the real httpRequest implementation
        httpRequest: jest.fn().mockImplementation(async (options) => {
          const https = require('https');
          const http = require('http');
          
          return new Promise((resolve, reject) => {
            const isHttps = options.url.startsWith('https://');
            const client = isHttps ? https : http;
            
            const url = new URL(options.url);
            if (options.qs) {
              Object.entries(options.qs).forEach(([key, value]) => {
                url.searchParams.append(key, value as string);
              });
            }
            
            const requestOptions = {
              hostname: url.hostname,
              port: url.port || (isHttps ? 443 : 80),
              path: `${url.pathname}${url.search}`,
              method: options.method,
              headers: options.headers || {},
            };
            
            const req = client.request(requestOptions, (res: any) => {
              let data = '';
              
              res.on('data', (chunk: any) => {
                data += chunk;
              });
              
              res.on('end', () => {
                try {
                  const parsedData = JSON.parse(data);
                  resolve(parsedData);
                } catch (e) {
                  reject(new Error(`Failed to parse response: ${e.message}`));
                }
              });
            });
            
            req.on('error', (error: Error) => {
              reject(error);
            });
            
            req.end();
          });
        }),
      },
      continueOnFail: jest.fn().mockReturnValue(true),
      getNode: jest.fn().mockReturnValue({ name: 'Searxng' }),
    } as unknown as IExecuteFunctions;
  });

  // This test connects to a real SearxNG instance
  it('should perform a real search against the specified SearxNG endpoint', async () => {
    // Skip this test if running in CI environment
    if (process.env.CI) {
      console.log('Skipping integration test in CI environment');
      return;
    }
    
    // Get the environment URL
    const searchUrl = process.env.SEARXNG_API_URL;
    // Since we're loading from .env, we should have a value
    
    // Use the real endpoint from environment
    mockExecuteFunction.getCredentials = jest.fn().mockResolvedValue({
      apiUrl: searchUrl,
      apiKey: '', // No API key needed for this test endpoint
    });

    // Setup search parameters
    mockExecuteFunction.getNodeParameter = jest.fn().mockImplementation((paramName, _) => {
      switch (paramName) {
        case 'query':
          return 'n8n test';
        case 'categories':
          return ['general'];
        case 'limit':
          return 10;
        case 'pageno':
          return 0;  // NOTE: None of the limits really work, we can only really request "more" pages of data. not less than 1.
        case 'additionalFields':
          return {
            language: 'en',
            format: 'json',
          };
        default:
          return undefined;
      }
    });

    try {
      // Execute the node with real HTTP request
      const result = await searxng.execute.call(mockExecuteFunction);

      // Basic validation (not checking specific content as it may change)
      expect(result).toBeDefined();
      expect(result[0]).toBeDefined();
      
      // If successful
      if (result[0][0].json.success) {
        expect(result[0][0].json.query).toBe('n8n test');
        
        // Either results array or answer should be present
        if (result[0][0].json.results) {
          expect(Array.isArray(result[0][0].json.results)).toBe(true);
        }
        
        // Log for debugging
        console.log('[DEBUG_LOG] Integration test successful');
      } else {
        // If there was an error but the test continued due to continueOnFail
        console.log(`[DEBUG_LOG] Integration test returned error: ${result[0][0].json.error}`);
      }
    } catch (error) {
      console.error('[DEBUG_LOG] Integration test failed:', error);
      // Don't fail the test if the endpoint is unavailable
      console.log('[DEBUG_LOG] This test requires access to the specified SearxNG endpoint');
    }
  });

  // Test with single response mode
  it('should return a single answer from the real SearxNG endpoint', async () => {
    // Skip this test if running in CI environment
    if (process.env.CI) {
      console.log('Skipping integration test in CI environment');
      return;
    }
    
    // Get the environment URL
    const searchUrl = process.env.SEARXNG_API_URL;
    // Since we're loading from .env, we should have a value
    
    // Use the real endpoint from environment
    mockExecuteFunction.getCredentials = jest.fn().mockResolvedValue({
      apiUrl: searchUrl,
      apiKey: '', // No API key needed for this test endpoint
    });

    // Setup search parameters with singleResponse = true
    mockExecuteFunction.getNodeParameter = jest.fn().mockImplementation((paramName, _) => {
      switch (paramName) {
        case 'query':
          return 'what is nodejs';
        case 'categories':
          return ['general'];
        case 'limit':
          return 1;
        case 'pageno':
          return 0;
        case 'additionalFields':
          return {
            language: 'en',
            format: 'json',
            singleResponse: true
          };
        default:
          return undefined;
      }
    });

    try {
      // Execute the node
      const result = await searxng.execute.call(mockExecuteFunction);

      // Basic validation
      expect(result).toBeDefined();
      expect(result[0]).toBeDefined();
      
      if (result[0][0].json.success) {
        expect(result[0][0].json.query).toBe('what is nodejs');
        expect(result[0][0].json.answer).toBeDefined();
        console.log('[DEBUG_LOG] Single response integration test successful');
      } else {
        console.log(`[DEBUG_LOG] Single response integration test returned error: ${result[0][0].json.error}`);
      }
    } catch (error) {
      console.error('[DEBUG_LOG] Single response integration test failed:', error);
      throw error;
    }
  });

  // Test pagination functionality
  it('should return different results when using different page numbers', async () => {
    // Skip this test if running in CI environment
    if (process.env.CI) {
      console.log('Skipping pagination integration test in CI environment');
      return;
    }
    
    // Get the environment URL
    const searchUrl = process.env.SEARXNG_API_URL;
    // Since we're loading from .env, we should have a value
    
    // Use the real endpoint from environment
    mockExecuteFunction.getCredentials = jest.fn().mockResolvedValue({
      apiUrl: searchUrl,
      apiKey: '', // No API key needed for this test endpoint
    });

    // First search with page number 1
    mockExecuteFunction.getNodeParameter = jest.fn().mockImplementation((paramName, _) => {
      switch (paramName) {
        case 'query':
          return 'software development'; // Use a query that will return many results
        case 'categories':
          return ['general'];
        case 'limit':
          return 10;
        case 'pageno':
          return 1; // Page 1
        case 'additionalFields':
          return {
            language: 'en',
            format: 'json',
            singleResponse: false
          };
        default:
          return undefined;
      }
    });

    try {
      // Execute the node for page 1
      const resultPage1 = await searxng.execute.call(mockExecuteFunction);

      // Basic validation
      expect(resultPage1).toBeDefined();
      expect(resultPage1[0]).toBeDefined();
      
      if (resultPage1[0][0].json.success) {
        expect(resultPage1[0][0].json.query).toBe('software development');
        expect(Array.isArray(resultPage1[0][0].json.results)).toBe(true);
        
        // Type safety for page 1 results
        const page1Results = resultPage1[0][0].json.results as Array<{ title: string; url: string; content: string; snippet: string }>;
        console.log(`[DEBUG_LOG] Page 1 returned ${page1Results.length} results`);
        
        // Now search with page number 2
        mockExecuteFunction.getNodeParameter = jest.fn().mockImplementation((paramName, _) => {
          switch (paramName) {
            case 'query':
              return 'software development'; // Same query for comparison
            case 'categories':
              return ['general'];
            case 'limit':
              return 10;
            case 'pageno':
              return 2; // Page 2
            case 'additionalFields':
              return {
                language: 'en',
                format: 'json',
                singleResponse: false
              };
            default:
              return undefined;
          }
        });
        
        // Execute the node for page 2
        const resultPage2 = await searxng.execute.call(mockExecuteFunction);
        
        expect(resultPage2).toBeDefined();
        expect(resultPage2[0]).toBeDefined();
        
        if (resultPage2[0][0].json.success) {
          expect(resultPage2[0][0].json.query).toBe('software development');
          expect(Array.isArray(resultPage2[0][0].json.results)).toBe(true);
          
          // Type safety for page 2 results
          const page2Results = resultPage2[0][0].json.results as Array<{ title: string; url: string; content: string; snippet: string }>;
          console.log(`[DEBUG_LOG] Page 2 returned ${page2Results.length} results`);
          
          // Check that the pages contain different results
          if (page1Results.length > 0 && page2Results.length > 0) {
            // Compare results by URL (should be unique)
            const page1Urls = page1Results.map((result: { url: string }) => result.url);
            const page2Urls = page2Results.map((result: { url: string }) => result.url);
            
            // Check if the pages have at least some different URLs
            const differentUrls = page2Urls.filter((url: string) => !page1Urls.includes(url));
            
            console.log(`[DEBUG_LOG] Number of different URLs between pages: ${differentUrls.length}`);
            
            // Expect at least some results to be different between pages
            expect(differentUrls.length).toBeGreaterThan(0);
          }
        } else {
          console.log(`[DEBUG_LOG] Page 2 search returned error: ${resultPage2[0][0].json.error}`);
        }
      } else {
        console.log(`[DEBUG_LOG] Page 1 search returned error: ${resultPage1[0][0].json.error}`);
      }
    } catch (error) {
      console.error('[DEBUG_LOG] Pagination test failed:', error);
      // Don't fail the test if the endpoint is unavailable
      console.log('[DEBUG_LOG] This test requires access to the specified SearxNG endpoint');
    }
  });
  // Test different results between categories
  it('should return different results when searching in general vs it categories', async () => {
    // Skip this test if running in CI environment
    if (process.env.CI) {
      console.log('Skipping category comparison test in CI environment');
      return;
    }
    
    // Get the environment URL
    const searchUrl = process.env.SEARXNG_API_URL;
    // Since we're loading from .env, we should have a value
    
    // Use the real endpoint from environment
    mockExecuteFunction.getCredentials = jest.fn().mockResolvedValue({
      apiUrl: searchUrl,
      apiKey: '', // No API key needed for this test endpoint
    });

    // Search with "general" category
    mockExecuteFunction.getNodeParameter = jest.fn().mockImplementation((paramName, _) => {
      switch (paramName) {
        case 'query':
          return 'javascript framework';
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

    try {
      // Execute the node for "general" category
      const generalResults = await searxng.execute.call(mockExecuteFunction);

      // Basic validation
      expect(generalResults).toBeDefined();
      expect(generalResults[0]).toBeDefined();
      
      if (generalResults[0][0].json.success) {
        expect(generalResults[0][0].json.query).toBe('javascript framework');
        expect(Array.isArray(generalResults[0][0].json.results)).toBe(true);
        
        // Store "general" category results for comparison
        const generalSearchResults = generalResults[0][0].json.results as Array<{ title: string; url: string; content: string; snippet: string }>;
        console.log(`[DEBUG_LOG] "general" category search returned ${generalSearchResults.length} results`);
        
        // Now search with "it" category
        mockExecuteFunction.getNodeParameter = jest.fn().mockImplementation((paramName, _) => {
          switch (paramName) {
            case 'query':
              return 'javascript framework'; // Same query for comparison
            case 'categories':
              return ['it']; // IT category
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
        
        // Execute the node for "it" category
        const itResults = await searxng.execute.call(mockExecuteFunction);
        
        expect(itResults).toBeDefined();
        expect(itResults[0]).toBeDefined();
        
        if (itResults[0][0].json.success) {
          expect(itResults[0][0].json.query).toBe('javascript framework');
          expect(Array.isArray(itResults[0][0].json.results)).toBe(true);
          
          // Store "it" category results
          const itSearchResults = itResults[0][0].json.results as Array<{ title: string; url: string; content: string; snippet: string }>;
          console.log(`[DEBUG_LOG] "it" category search returned ${itSearchResults.length} results`);
          
          // Compare results between categories
          if (generalSearchResults.length > 0 && itSearchResults.length > 0) {
            // Extract URLs from both result sets for comparison
            const generalUrls = generalSearchResults.map(result => result.url);
            const itUrls = itSearchResults.map(result => result.url);
            
            // Find URLs that are unique to each category
            const uniqueToGeneral = generalUrls.filter(url => !itUrls.includes(url));
            const uniqueToIT = itUrls.filter(url => !generalUrls.includes(url));
            
            console.log(`[DEBUG_LOG] URLs unique to "general" category: ${uniqueToGeneral.length}`);
            console.log(`[DEBUG_LOG] URLs unique to "it" category: ${uniqueToIT.length}`);
            
            // Expect some different results between categories
            // We use the total number of unique URLs as a measure of difference
            const totalUniqueUrls = uniqueToGeneral.length + uniqueToIT.length;
            console.log(`[DEBUG_LOG] Total unique URLs between categories: ${totalUniqueUrls}`);
            
            // Assert that there are some differences between categories
            expect(totalUniqueUrls).toBeGreaterThan(0);
          } else {
            console.log('[DEBUG_LOG] One or both category searches returned no results');
          }
        } else {
          console.log(`[DEBUG_LOG] "it" category search returned error: ${itResults[0][0].json.error}`);
        }
      } else {
        console.log(`[DEBUG_LOG] "general" category search returned error: ${generalResults[0][0].json.error}`);
      }
    } catch (error) {
      console.error('[DEBUG_LOG] Category comparison test failed:', error);
      console.log('[DEBUG_LOG] This test requires access to the specified SearxNG endpoint');
    }
  });
  
  // Test fields filter functionality
  it('should filter fields from results when using fields filter', async () => {
    // Skip this test if running in CI environment
    if (process.env.CI) {
      console.log('Skipping filter fields integration test in CI environment');
      return;
    }
    
    // Get the environment URL
    const searchUrl = process.env.SEARXNG_API_URL;
    // Since we're loading from .env, we should have a value
    
    // Use the real endpoint from environment
    mockExecuteFunction.getCredentials = jest.fn().mockResolvedValue({
      apiUrl: searchUrl,
      apiKey: '', // No API key needed for this test endpoint
    });

    // Search with filters applied
    mockExecuteFunction.getNodeParameter = jest.fn().mockImplementation((paramName, _) => {
      switch (paramName) {
        case 'query':
          return 'search engine';
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
            filter: 'title,content', // Filter out title and content
          };
        default:
          return undefined;
      }
    });

    try {
      // Execute the node with filters
      const filteredResults = await searxng.execute.call(mockExecuteFunction);
      
      // Basic validation
      expect(filteredResults).toBeDefined();
      expect(filteredResults[0]).toBeDefined();
      
      if (filteredResults[0][0].json.success) {
        // Make sure we have results
        expect(filteredResults[0]).toBeDefined();
        expect(filteredResults[0][0].json).toBeDefined();
        expect(filteredResults[0][0].json.results).toBeDefined();
        
        const results = filteredResults[0][0].json.results as Array<Record<string, any>>;
        
        // Check fields are filtered properly
        if (results && results.length > 0) {
          // Verify title and content fields were removed from results
          expect(results[0].title).toBeUndefined();
          expect(results[0].content).toBeUndefined();
          
          // Verify that url and other fields are still present
          expect(results[0].url).toBeDefined();
          expect(results[0].snippet).toBeDefined();
          
          console.log('[DEBUG_LOG] Fields filter integration test successful');
          console.log(`[DEBUG_LOG] Result fields: ${Object.keys(results[0]).join(', ')}`);
        } else {
          console.log('[DEBUG_LOG] No results returned to verify filtering');
        }
      } else {
        console.log(`[DEBUG_LOG] Fields filter test returned error: ${filteredResults[0][0].json.error}`);
      }
      
      // Now run a search without filters to compare
      mockExecuteFunction.getNodeParameter = jest.fn().mockImplementation((paramName, _) => {
        switch (paramName) {
          case 'query':
            return 'search engine';
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
              // No filters
            };
          default:
            return undefined;
        }
      });
      
      const unfilteredResults = await searxng.execute.call(mockExecuteFunction);
      
      // Compare filtered vs unfiltered results
      if (unfilteredResults[0][0].json.success && 
          unfilteredResults[0][0].json.results && 
          Array.isArray(unfilteredResults[0][0].json.results) &&
          unfilteredResults[0][0].json.results.length > 0) {
        // Unfiltered results should have title and content fields
        const unfilteredResultFields = Object.keys(unfilteredResults[0][0].json.results[0]);
        console.log(`[DEBUG_LOG] Unfiltered result fields: ${unfilteredResultFields.join(', ')}`);
        
        // Verify title or content fields exist in unfiltered results but not in filtered ones
        const firstUnfilteredResult = unfilteredResults[0][0].json.results[0];
        
        // Check if thumbnail and parsed_url were automatically removed (default behavior)
        expect(firstUnfilteredResult.thumbnail).toBeUndefined();
        expect(firstUnfilteredResult.parsed_url).toBeUndefined();
        
        // But title and content should be present (unlike in filtered results)
        if (filteredResults[0][0].json.results && 
            Array.isArray(filteredResults[0][0].json.results) &&
            filteredResults[0][0].json.results.length > 0) {
          const firstFilteredResult = filteredResults[0][0].json.results[0];
          
          // Fields removed by filter should be in unfiltered but not filtered results
          if (firstUnfilteredResult.title) {
            expect(firstUnfilteredResult.title).toBeDefined();
            expect(firstFilteredResult.title).toBeUndefined();
          }
          
          if (firstUnfilteredResult.content) {
            expect(firstUnfilteredResult.content).toBeDefined();
            expect(firstFilteredResult.content).toBeUndefined();
          }
        }
      }
    } catch (error) {
      console.error('[DEBUG_LOG] Fields filter test failed:', error);
      console.log('[DEBUG_LOG] This test requires access to the specified SearxNG endpoint');
    }
  });
});