import React, {createContext, useContext} from "react";
import {builderFor} from "ts-byob";
import {faker} from "@faker-js/faker";

export type User = {
    id: string;
    name: string;
};

export const aUser = builderFor<User>(() => ({
    id: faker.string.uuid(),
    name: faker.person.fullName()
}))

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