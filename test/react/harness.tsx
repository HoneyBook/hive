import {IOTestKit} from "./io-testkit";
import {AuthTestKit} from "./auth-testkit";
import {createRunner, Runner} from "../../src/runner";
import {render} from "@testing-library/react";
import {App} from "./app";

type TestKits = [IOTestKit, AuthTestKit];

export class ShopAppRunner extends Runner<TestKits> {

    constructor() {
        super({
            kits: [new IOTestKit(), new AuthTestKit()],
        });
    }

    run() {
        // TODO Nirel - can we make the API for getting a dependency nicer?
        // it's too verbose and note now Auth's and IO's type is a union type of all test kits - it's a bit bizarre
        const Auth = this.kitsMap.AuthTestKit;
        const IO = this.kitsMap.IOTestKit;

        const ui = render(
            <Auth.Provider>
                <IO.Provider>
                    <App/>
                </IO.Provider>
            </Auth.Provider>)
        ;

        return {...this.result, ui}
    }

    static create() {
        return createRunner<TestKits, ShopAppRunner>({appRunnerClass: ShopAppRunner});
    }

}