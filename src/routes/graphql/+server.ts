import { readFileSync } from 'fs';
import resolvers from '../../resolvers.js';
import { ApolloServer, HeaderMap, type BaseContext, type ContextFunction, type HTTPGraphQLRequest } from '@apollo/server';
import { parse } from 'url';
import { join } from 'path';
import { PROJECT_PATH } from '$env/static/private';

interface MyContextFunctionArgument {
  req: Request;
  res: Response;
}
interface HTTPGraphQLHead {
  status?: number;
  headers: HeaderMap;
}

type HTTPGraphQLResponseBody =
  | { kind: 'complete'; string: string }
  | { kind: 'chunked'; asyncIterator: AsyncIterableIterator<string> };

type HTTPGraphQLResponse = HTTPGraphQLHead & {
  body: HTTPGraphQLResponseBody;
};

const defaultContext: ContextFunction<[MyContextFunctionArgument], any> = async () => ({});
const context: ContextFunction<[MyContextFunctionArgument], BaseContext> = defaultContext;

let path = join(PROJECT_PATH, 'src', 'schema.graphql');
if (process.env.NODE_ENV !== 'development') {
  path = join(PROJECT_PATH, 'schema.graphql');
}
const typeDef = readFileSync(path, 'utf8');
const server = new ApolloServer({ 
  typeDefs: typeDef, 
  resolvers,
  csrfPrevention: false,
});

server.start().catch(err => console.error(err));

export async function POST({ request }) {
  const headers = new HeaderMap();
  for (const [key, value] of Object.entries(request.headers)) {
    if (value !== undefined) {
      headers.set(key, Array.isArray(value) ? value.join(', ') : value);
    }
  }
  const httpGraphQLRequest: HTTPGraphQLRequest = {
    method: 'POST',
    headers,
    body: await request.json(),
    search: parse(request.url).search ?? '',
  };

  const result = await server
  .executeHTTPGraphQLRequest({
    httpGraphQLRequest,
    context: () => context({ req: request, res: new Response}), // Provide a valid Response object instead of null
  });

  if (result.body.kind === 'complete') {
    // complete the response
    return new Response(result.body.string, {
      status: 200,
      headers: { 'content-type': 'application/json', },
    });
  }
  if (result.body.kind === 'chunked' && 'asyncIterator' in result.body) {
    // chunked response
    const chunkedBody = result.body as { asyncIterator: AsyncIterableIterator<any> };
    return new Response(
      new ReadableStream({
        async start(controller) {
          for await (const chunk of chunkedBody.asyncIterator) {
            controller.enqueue(chunk);
          }
          controller.close();
        },
      }), { 
        status: 200, 
        headers: { 'content-type': 'application/json', }, 
      },
    );
  }
}
