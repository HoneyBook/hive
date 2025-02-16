"use client";

import React, {Suspense, useActionState, useId, useState} from "react";
import {useProducts} from "./products";
import {useUser} from "./auth";

export const Shop = () => {
    const {user} = useUser();

    if (!user) {
        return <div>Please login</div>;
    }

    console.log("rendering shop for user", user);

    return <div>
        <h1>{user.name}'s Shop</h1>
        <CreateProduct/>
        <Products/>
    </div>;

};

const CreateProduct = () => {
    const {createProduct} = useProducts();
    const [name, setName] = useState("");
    const [price, setPrice] = useState("");

    const handleSubmit = () => {
        createProduct({name, price});
        setName("");
        setPrice("");
    }

    return <div>
        <label>
            Product Name
            <input type="text" name="name" onChange={(e) => setName(e.target.value)} value={name}/>
        </label>
        <label>
            Price
            <input type="number" name="price" onChange={(e) => setPrice(e.target.value)} value={price}/>
        </label>
        <button onClick={handleSubmit}>Create Product</button>
    </div>
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