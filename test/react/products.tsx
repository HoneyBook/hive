import axios, {AxiosInstance} from 'axios';
import React, {createContext, useContext} from 'react';
import {User, useUser} from './auth';
import {builderFor} from "ts-byob";
import {faker} from "@faker-js/faker";
import {useMutation, useQuery, useQueryClient, useSuspenseQuery} from "@tanstack/react-query";

export type Product = {
  id: string;
  name: string;
  price: string;
}

export const aProduct = builderFor<Product>(() => ({
  id: faker.string.uuid(),
  name: faker.commerce.productName(),
    price: faker.commerce.price(),
}));

export type UserProducts = Map<User["id"], Product[]>;

export class HttpProductAdapter {
  constructor(private readonly client: AxiosInstance) {}

  async getProducts(userId: User["id"]): Promise<Product[]> {
    const response = await this.client.get(`/products/${userId}`);
    return response.data;
  }

  async createProduct(userId: User["id"], product: Omit<Product, 'id'>): Promise<string> {
    const response = await this.client.post(`/products/${userId}`, product);
    return response.data;
  }
}

export type ProductAdapter = Omit<HttpProductAdapter, 'client'>;

const IOContext = createContext<{
  productAdapter: ProductAdapter;
}>({
  productAdapter: new HttpProductAdapter(axios.create({baseURL: 'http://localhost:3000'})),
});

export const useProducts = () => {
  const { user, isAuthenticated } = useUser();
  const { productAdapter } = useContext(IOContext);
  const queryClient = useQueryClient();

  const queryKey = ['products', user?.id];

  const {data: products, isLoading, error} = useQuery({
    queryKey,
    queryFn: () => {
      if (!isAuthenticated(user)) {
        throw new Error('User not found');
      }
      return productAdapter.getProducts(user.id);
    },
  });

  const { mutate: createProduct } = useMutation({
    mutationFn: (product: Omit<Product, 'id'>) => {
      if (!isAuthenticated(user)) {
        throw new Error('User not found');
      }
      return productAdapter.createProduct(user.id, product);
    },
    onSuccess: () => {
        return queryClient.invalidateQueries({queryKey});
    }
  });

  return { products, createProduct, isLoading, error };
};

export const IOContextProvider = ({ productsAdapter, children }: { productsAdapter: ProductAdapter, children: React.ReactNode }) => {
  return <IOContext.Provider value={{ productAdapter: productsAdapter }}>{children}</IOContext.Provider>;
};

