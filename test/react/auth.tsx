import React, { createContext, useContext, useState } from "react";

export type User = {
    id: string;
    name: string;
};

const AuthContext = createContext<{
    user: User | null;
}>({
    user: null,
});

export const useUser = () => {
    const { user } = useContext(AuthContext);

    const isAuthenticated = (user: User | null): user is User => user !== null;

    return { user, isAuthenticated };
};

export const AuthProvider = ({ user, children }: { user: User, children: React.ReactNode }) => {

    return <AuthContext.Provider value={{ user }}>{children}</AuthContext.Provider>
}