/**
 * Vite plugin that intercepts /api/* requests during local dev and
 * forwards them to the Edge-style TS handlers in ../../api/*.ts.
 *
 * Vite's SSR pipeline handles TS natively, so no build step needed.
 */
export declare function apiMiddleware(): {
    name: string;
    configureServer(server: any): void;
};
