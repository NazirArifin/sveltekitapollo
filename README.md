# Integrasi SvelteKit dan Apollo Server

## Deskripsi

Repository ini berisi contoh penggunaan Apollo Server pada SvelteKit. Apollo Server digunakan untuk membuat GraphQL server yang akan digunakan oleh aplikasi SvelteKit. Dengan menggunakan Apollo Server, kita dapat membuat server yang memproses query dan mutation dari aplikasi SvelteKit.

## Instalasi SveteKit dan Apollo Server

Untuk membuat aplikasi SvelteKit, kita dapat mengikuti langkah-langkah yang ada di [dokumentasi SvelteKit](https://kit.svelte.dev/docs/creating-a-project). Karena saya menggunakan adapter node, maka jangan lupa untuk menambahkan adapter node pada aplikasi SvelteKit.


```bash
npm install --save-dev @sveltejs/adapter-node
```

lalu ubah adapter node pada file `svelte.config.js`.

```javascript
import adapter from '@sveltejs/adapter-node';
```

### Pengaturan .env

Untuk mengatur environment variable pada aplikasi SvelteKit, kita dapat membuat file `.env` dan `.env.production` pada root folder aplikasi. File-file ini akan digunakan untuk menyimpan environment variable yang akan digunakan pada aplikasi SvelteKit seperti pengaturan koneksi ke database, secret key, dan lain-lain. Sementara kita hanya butuh satu environment variable yaitu `PROJECT_PATH` yang akan digunakan untuk menyimpan path dari project disaat development dan production.

Isi dari file `.env`:
```env
NODE_ENV=development
PROJECT_PATH=.
```

Isi dari file `.env.production`:
```env
PROJECT_PATH=.
```

### Instalasi Apollo Server

Setelah itu, kita dapat menambahkan Apollo Server ke dalam aplikasi SvelteKit.  

```bash
npm install @apollo/server @apollo/subgraph graphql graphql-tag
```

## Membuat Apollo Server

### Membuat Schema

Pertama, kita akan membuat schema GraphQL yang akan digunakan oleh Apollo Server. Schema ini akan mendefinisikan tipe data yang akan digunakan oleh server. Kita akan membuat schema yang berisi tipe data `Query` saja. File schema ini akan disimpan pada folder `src/schema.graphql`.

```graphql
type Book {
  title: String
  author: String
}

type Query {
  hello: String
  books: [Book]
}
```

### Membuat Resolvers

Setelah membuat schema, kita akan membuat resolvers yang akan digunakan oleh Apollo Server. Resolvers ini akan memproses query yang dikirimkan oleh aplikasi SvelteKit. Resolvers ini akan disimpan pada folder `src/resolvers.ts`.

```typescript
export default {
  Query: {
    hello: () => 'Hello World',
    books: () => {
      return [
        {
          title: 'The Awakening',
          author: 'Kate Chopin',
        },
        {
          title: 'City of Glass',
          author: 'Paul Auster',
        },
      ];
    },
  }
}
```

Untuk sementara, kita hanya membuat resolvers untuk `Query` saja dengan dua query yaitu `hello` dan `books`. Data di dalam `books` adalah data dummy yang kita gunakan untuk contoh.

### Membuat Apollo Server

Setelah membuat schema dan resolvers, kita akan membuat Apollo Server yang akan digunakan oleh aplikasi SvelteKit. Server ini akan dapat diakses melalui endpoint `/graphql`. File server ini akan disimpan pada folder `src/routes/graphql/+server.ts`.

```typescript
import { ApolloServer, HeaderMap, type BaseContext, type ContextFunction, type HTTPGraphQLRequest } from '@apollo/server';
import { readFileSync } from 'fs';
import resolvers from '../../resolvers.js';
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
```

Kode awal adalah beberapa `import` dan `interface` yang akan digunakan oleh Apollo Server. Abaikan jika tidak memahami kode tersebut. Terus terang saya juga tidak paham, kebanyakan saya copy-paste dari dokumentasi Apollo Server :D.

```typescript
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
```

Setelah itu, kode kita lanjutkan dibawahnya dengan menambahkan kode untuk membaca schema yang telah kita buat sebelumnya. Kita menggunakan `readFileSync` untuk membaca file schema yang kita buat. Kita juga menambahkan `csrfPrevention: false` untuk menonaktifkan csrf prevention pada Apollo Server. `server.start()` digunakan untuk menjalankan Apollo Server.

```typescript
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
```

Kode berikutnya adalah kode untuk menangani request yang masuk ke Apollo Server. Kita menggunakan `POST` method untuk menangani request yang masuk. Kita menggunakan `executeHTTPGraphQLRequest` untuk mengeksekusi query yang dikirimkan oleh aplikasi SvelteKit. Bagian `headers` dan `status` di `Response` saya set manual saja, soalnya saya keburu


### Ujicoba

Untuk menguji apakah Apollo Server berjalan dengan baik, kita dapat menggunakan aplikasi `graphql client` seperti `Insomnia` atau `Postman`. Kita dapat mengirimkan query `hello` dan `books` ke Apollo Server dengan mengakses endpoint `http://localhost:5173/graphql`.

```graphql
query {
  hello
  books {
    title
    author
  }
}
```

Jika Apollo Server berjalan dengan baik, maka kita akan mendapatkan response dari query yang kita kirimkan.

## Build dan Deploy

Untuk build, berdasarkan kode yang diatas, dibagian:

```typescript
...
let path = join(PROJECT_PATH, 'src', 'schema.graphql');
if (process.env.NODE_ENV !== 'development') {
  path = join(PROJECT_PATH, 'schema.graphql');
}
...
```

Kita perlu menyalin file `schema.graphql` ke dalam folder root project. Setelah build selesai, file tersebut dipindahkan ke dalam folder `build` (default dari Vite). Untuk sementara, kita bisa menggunakan `scripts` pada `package.json` untuk menyalin file tersebut. Contohnya:

```json
{
  ...
  "scripts": {
    "copyWindows": "copy src\\schema.graphql . && vite build && move /y schema.graphql build\\schema.graphql",
    "copyLinux": "cp src/schema.graphql . && vite build && mv schema.graphql build/schema.graphql",
    ...
  }
  ...
}
```

`copyWindows` untuk Windows dan `copyLinux` untuk Linux. Kita bisa menggunakan `npm run copyWindows` atau `npm run copyLinux` menyalin file `schema.graphql` ke dalam folder root project, build aplikasi, dan memindahkan file `schema.graphql` ke dalam folder `build`.

## Kesimpulan

Kode lengkap ada pada repository ini. Dengan menggunakan Apollo Server, kita dapat membuat GraphQL server yang akan digunakan oleh aplikasi SvelteKit. Apollo Server memudahkan kita dalam membuat server GraphQL yang dapat digunakan oleh aplikasi SvelteKit.