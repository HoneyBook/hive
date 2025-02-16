import '@testing-library/jest-dom/vitest';
import {describe, expect, it} from "vitest";
import {aProduct, Product} from "./products";
import {ShopAppRunner} from "./harness";
import {userEvent} from "@testing-library/user-event";
import {faker} from "@faker-js/faker";
import {aUser} from "./auth";

describe('the shop', () => {
    it("renders a user's products", async () => {
        const user = aUser();
        const p1 = aProduct();
        const p2 = aProduct();
        const p3 = aProduct();
        const {ui} = ShopAppRunner.create()
            .withUser(user)
            .withUserProducts(user.id, [p1, p2, p3])
            .run();

        expect(await ui.findByText(p1.name)).toBeInTheDocument();
        expect(ui.getByText(p2.name)).toBeInTheDocument();
        expect(ui.getByText(p3.name)).toBeInTheDocument();
    })

    it("creates a new product", async () => {

        const {ui, productAdapter, user } = ShopAppRunner.create().run();

        const name = faker.commerce.productName();
        const price = faker.commerce.price();

        await userEvent.type(ui.getByLabelText('Product Name'), name);
        await userEvent.type(ui.getByLabelText('Price'), price);
        await userEvent.click(ui.getByText('Create Product'));

        expect(await ui.findByText(name)).toBeInTheDocument();
        expect(productAdapter.products.get(user.id)).toContainEqual(expect.objectContaining({name, price}));

    })
});