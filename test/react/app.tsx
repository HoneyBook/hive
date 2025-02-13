import React, {useMemo, Component, ReactNode} from "react";
import {Shop} from "./shop";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
export const App = () => {
    const client = useMemo(() => new QueryClient(), []);

    return (
            <QueryClientProvider client={client}>
                <Shop/>
            </QueryClientProvider>
    );
}