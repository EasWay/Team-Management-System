declare module 'fastify' {
  export interface FastifyInstance {
    get(path: string, options: any, handler: (request: any, reply: any) => any): void;
    post(path: string, options: any, handler: (request: any, reply: any) => any): void;
    put(path: string, options: any, handler: (request: any, reply: any) => any): void;
    delete(path: string, options: any, handler: (request: any, reply: any) => any): void;
  }
}
