import React, {PropsWithChildren} from 'react';
import {Kit} from '../../src/kit';
import {aUser, AuthProvider, User} from "./auth";

export class AuthTestKit extends Kit {
    result: { user: User } = {user: aUser()};

    name = "AuthTestKit";

    withUser(user: User): void {
        this.result.user = user;
    }

    get Provider(): React.FC<PropsWithChildren> {
        return ({children}) => <AuthProvider user={this.result.user}>{children}</AuthProvider>;
    }

}