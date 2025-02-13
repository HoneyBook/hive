import {TestKit} from '../../src/test-kit';
import {aUser, AuthProvider, User} from "./auth";
import React, {PropsWithChildren} from "react";

export class AuthTestKit extends TestKit {
    result: { user: User } = {user: aUser()};

    name = "AuthTestKit";

    withUser(user: User): void {
        this.result.user = user;
    }

    get Provider(): React.FC<PropsWithChildren> {
        return ({children}) => <AuthProvider user={this.result.user}>{children}</AuthProvider>;
    }

}