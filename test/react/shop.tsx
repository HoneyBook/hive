import React from "react";
import { useProducts } from "./products";
import { useUser } from "./auth";

export const Shop = () => {
  const {user} = useUser();
  const {products, isLoading, createProduct} = useProducts();

  if (!user) {
    return <div>Please login</div>;
  }

  if (isLoading || !products) {
    return <div>Loading...</div>;
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.target as HTMLFormElement);
    createProduct({name: formData.get('name') as string, price: parseInt(formData.get('price') as string)});
  }

  return <div>
    <h1>{user.name}'s Shop</h1>
    <ul>
      {products.map((product) => (
        <li key={product.id}>{product.name}</li>
      ))}
    </ul>
    <form onSubmit={handleSubmit}>
      <input type="text" name="name" />
      <input type="number" name="price" />
      <button type="submit">Create Product</button>
    </form>
  </div>;

};
