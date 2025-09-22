import {
    IDataObject,
    IExecuteFunctions,
    INodeExecutionData,
    INodeType,
    INodeTypeDescription,
    NodeConnectionTypes,
    NodeOperationError,
} from "n8n-workflow";

export class Searxng implements INodeType {
    description: INodeTypeDescription = {
        displayName: "Searxng",
        name: "searxng",
        icon: "file:searxng.svg",
        group: ["transform"],
        version: 1,
        subtitle: '={{$parameter["operation"]}}',
        description: "Perform web searches using Searxng",
        defaults: {
            name: "Searxng",
        },
        inputs: [
            {
                type: NodeConnectionTypes.Main,
            },
        ],
        outputs: [
            {
                type: NodeConnectionTypes.Main,
            },
        ],
        usableAsTool: true,
        credentials: [
            {
                name: "searxngApi",
                required: true,
            },
        ],
        // Add AI tool metadata
        codex: {
            categories: ["Search", "Web"],
            alias: ["web-search", "searxng", "search-engine"],
            subcategories: {
                search: ["Web Search", "Metasearch"],
            },
        },
        properties: [
            {
                displayName: "Operation",
                name: "operation",
                type: "options",
                noDataExpression: true,
                options: [
                    {
                        name: "Search",
                        value: "search",
                        description: "Perform a search query",
                        action: "Perform a search query",
                    },
                ],
                default: "search",
            },
            {
                displayName: "Query",
                name: "query",
                type: "string",
                default: "",
                required: true,
                placeholder: "Enter search query",
                description: "The search query to perform",
                hint: "Can be provided directly or via AI agent input",
            },
            {
                displayName: "Categories",
                name: "categories",
                type: "multiOptions",
                options: [
                    {name: "General", value: "general"},
                    {name: "Images", value: "images"},
                    {name: "News", value: "news"},
                    {name: "Videos", value: "videos"},
                    {name: "Files", value: "files"},
                    {name: "IT", value: "it"},
                    {name: "Maps", value: "map"},
                    {name: "Music", value: "music"},
                    {name: "Science", value: "science"},
                    {name: "Social Media", value: "social media"},
                ],
                default: ["general", "it", "files", "science"],
                description: "Categories to search in",
            },
            {
                displayName: "Limit",
                name: "limit",
                type: "number",
                typeOptions: {
                    minValue: 1,
                },
                default: 10,
                description: "Soft Limits the results in memory",
            },
            {
                displayName: "Page Number",
                name: "pageno",
                type: "number",
                typeOptions: {
                    minValue: 0,
                },
                default: 0,
                description: "Page number of results",
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                options: [
                    {
                        displayName: "Language",
                        name: "language",
                        type: "options",
                        options: [
                            {name: "English", value: "en"},
                            {name: "German", value: "de"},
                            {name: "French", value: "fr"},
                            {name: "Spanish", value: "es"},
                            {name: "Italian", value: "it"},
                            {name: "All Languages", value: "all"},
                        ],
                        default: "en",
                        description: "Language of the search results",
                    },
                    {
                        displayName: "Time Range",
                        name: "time_range",
                        type: "options",
                        options: [
                            // NOTE: This is wrong, all throws an error.
                            {name: "Any Time", value: ""},
                            {name: "Day", value: "day"},
                            {name: "Week", value: "week"},
                            {name: "Month", value: "month"},
                            {name: "Year", value: "year"},
                        ],
                        default: "",
                        description: "Time range for the search results",
                    },
                    {
                        displayName: "Safe Search",
                        name: "safesearch",
                        type: "options",
                        options: [
                            {name: "Off", value: "0"},
                            {name: "Moderate", value: "1"},
                            {name: "Strict", value: "2"},
                        ],
                        default: "2",
                        description: "Safe search level",
                    },
                    {
                        displayName: "Fields Filter",
                        name: "filter",
                        type: "string",
                        default: "thumbnail,positions,parsed_url",
                        description: "Comma separated list of fields to drop to optimize response. eg (thumbnail, positions, parsed_url)",
                    },
                    {
                        displayName: "Format",
                        name: "format",
                        type: "options",
                        options: [
                            {name: "HTML", value: "html"},
                            {name: "JSON", value: "json"},
                            {name: "RSS", value: "rss"},
                        ],
                        default: "json",
                        description: "Output format of the search results",
                    },
                    {
                        displayName: "Raw Response",
                        name: "rawResponse",
                        type: "boolean",
                        default: false,
                        description: "Return original content in the `raw` field (expensive)",
                    },
                    {
                        displayName: "Return Single Response",
                        name: "singleResponse",
                        type: "boolean",
                        default: false,
                        description: "(Legacy) Return the first response in an `answer` field.",
                    },
                ],
            },
        ],
    };

    async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
        const items = this.getInputData();
        const returnData: INodeExecutionData[] = [];

        try {
            const credentials = await this.getCredentials("searxngApi");
            if (!credentials) {
                throw new NodeOperationError(
                    this.getNode(),
                    "No credentials got returned!",
                );
            }

            for (let i = 0; i < items.length; i++) {
                // Enhanced input handling for AI compatibility
                let query: string
                const item = items[i].json as IDataObject

                if (item) {
                    if (typeof item.query === 'string') {
                        query = item.query
                    } else if (typeof item.input === 'string') {
                        query = item.input
                    } else if (typeof item.prompt === 'string') {
                        query = item.prompt
                    } else {
                        query = this.getNodeParameter("query", i) as string
                    }
                } else {
                    query = this.getNodeParameter("query", i) as string;
                }

                let categories = this.getNodeParameter("categories", i) as string[] | string;

                // BUG: This positional alignment sucks, can we improve it?
                const additionalFields = this.getNodeParameter("additionalFields", i) as {
                    language?: string | undefined;
                    // limit?: number | undefined;
                    time_range?: string | undefined;
                    safesearch?: string | undefined;
                    // pageno?: number | undefined;
                    filter?: string | undefined;
                    format?: string | undefined;
                    rawResponse?: boolean | undefined;
                    singleResponse?: boolean | undefined;
                };

                const limit = this.getNodeParameter("limit", i) as number;
                const pageno = this.getNodeParameter("pageno", i) as number;

                const defaultFilters = 'thumbnail, parsed_url , positions';
                const filters = (additionalFields.filter || defaultFilters)?.split(',')

                if (typeof categories === 'string') {
                    console.log('categories was a string value')
                    categories = [categories];
                }

                const queryParameters: Record<string, string | number> = {
                    q: query,
                    // BUG: This categories throws an error frequently, is it because of the type? ^
                    categories: (categories || ['general']).join(","),
                    format: additionalFields.format || "json",
                };

                if (additionalFields.language)
                    queryParameters.language = additionalFields.language;
                if (additionalFields.time_range)
                    queryParameters.time_range = additionalFields.time_range;
                if (additionalFields.safesearch)
                    queryParameters.safesearch = additionalFields.safesearch;
                // if (additionalFields.pageno)
                // queryParameters.pageno = additionalFields.pageno;
                if (pageno > 0)
                    queryParameters.pageno = pageno;


                try {
                    const response = await this.helpers.httpRequest({
                        method: "GET" as const,
                        url: `${credentials.apiUrl}/search`,
                        qs: queryParameters,
                        headers: {
                            Accept: "application/json",
                            Authorization: `Bearer ${credentials.apiKey}`,
                        },
                    });

                    // Format output for AI compatibility
                    let results = Array.isArray(response.results)
                        ? response.results.map((result: any) => {
                            // Save snippet before applying filters
                            const snippet = result.snippet || result.content;

                            // Apply user-defined filters
                            if (filters && filters.length > 0) {
                                filters.forEach((f) => {
                                    const fieldName = f.trim();
                                    if (fieldName) {
                                        delete result[fieldName];
                                    }
                                });
                            }
                            
                            // Always ensure snippet is present even if content was filtered
                            return { ...result, snippet };
                        })
                        : [];

                    const metadata = {
                        total: results.length,
                        totalReturned: 0,
                        filtered: false,
                        queryParameters,
                        additionalFields
                    }

                    // TODO: The singleResponse mechanism has a highly specific behavior.  Maintain? Remove?
                    let answer: string | undefined = undefined;
                    if (additionalFields.singleResponse && results.length > 0) {
                        answer = results[0].content || results[0].snippet
                        results = [results[0]]
                    } else if (limit > 0 && results.length > limit) {
                        results = results.slice(0, limit);
                    }

                    metadata.totalReturned = results.length
                    metadata.filtered = metadata.totalReturned !== metadata.total

                    let rawResponse: any | undefined = undefined
                    if (additionalFields.rawResponse)
                        rawResponse = response

                    returnData.push({
                        json: {
                            success: true,
                            metadata,
                            query,
                            answer,
                            results,
                            // TODO: What compatibility is necessary here?
                            rawResponse
                        },
                    });

                } catch (error) {
                    if (this.continueOnFail()) {
                        returnData.push({
                            json: {
                                success: false,
                                error: error.message,
                                query,
                            },
                        });
                        continue;
                    }
                    throw error;
                }
            }

            return [returnData];

        } catch (error) {
            console.error('An error was thrown', error);
            if (this.continueOnFail()) {
                return [returnData];
            }
            throw error;
        }
    }
}
