import React, {Suspense, useId, useState} from "react";
import {useProducts} from "./products";
import {useUser} from "./auth";

export const Shop = () => {
    const {user} = useUser();

    if (!user) {
        return <div>Please login</div>;
    }

    return <div>
        <h1>{user.name}'s Shop</h1>
        <CreateProduct/>
        <Products/>
    </div>;

};

const CreateProduct = () => {
    const {createProduct} = useProducts();

    const handleSubmit = (formData: FormData) => {
        createProduct({name: formData.get("name"), price: formData.get("price")});
    }

    return <form action={handleSubmit}>
        <label>
            Product Name
            <input type="text" name="name"/>
        </label>
        <label>
            Price
            <input type="number" name="price"/>
        </label>
        <button type="submit">Create Product</button>
    </form>
}

const Products = () => {
    const {products, isLoading} = useProducts();

    if (isLoading || !products) {
        return <div>Loading...</div>
    }

    return <div>
        <h2>Products:</h2>
        <ul>
            {products.map((product) => (
                <li key={product.id}>{product.name}</li>
            ))}
        </ul>
    </div>
}