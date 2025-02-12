import axios, {AxiosInstance} from 'axios';
import React, { createContext, useContext } from 'react';
import { User, useUser } from './auth';
import { useQuery, useMutation } from 'react-query';

export type Product = {
  id: string;
  name: string;
  price: number;
}

export class HttpProductAdapter {
  constructor(private readonly client: AxiosInstance) {}

  async getProducts(user: User): Promise<Product[]> {
    const response = await this.client.get(`/products/${user.id}`);
    return response.data;
  }

  async createProduct(user: User, product: Omit<Product, 'id'>): Promise<string> {
    const response = await this.client.post(`/products/${user.id}`, product);
    return response.data;
  }
}

export type ProductAdapter = Omit<HttpProductAdapter, 'client'>;

export class MemoryProductAdapter implements ProductAdapter {
  
  constructor(readonly products: Map<User, Product[]> = new Map()) {}
  
  async createProduct(user: User, product: Omit<Product, 'id'>): Promise<string> {
    const id = crypto.randomUUID();
    this.products.set(user, [...this.products.get(user) || [], {...product, id}]);
    return id;
  }

  async getProducts(user: User): Promise<Product[]> {
    return this.products.get(user) || [];
  }

}

const IOContext = createContext<{
  productAdapter: ProductAdapter;
}>({
  productAdapter: new HttpProductAdapter(axios.create({baseURL: 'http://localhost:3000'})),
});

export const useProducts = () => {
  const { user, isAuthenticated } = useUser();
  const { productAdapter } = useContext(IOContext);

  const { data: products, isLoading, error } = useQuery({
    queryKey: ['products'],
    queryFn: () => {
      if (!isAuthenticated(user)) {
        throw new Error('User not found');
      }
      return productAdapter.getProducts(user);
    },
  });

  const { mutate: createProduct } = useMutation({
    mutationFn: (product: Omit<Product, 'id'>) => {
      if (!isAuthenticated(user)) {
        throw new Error('User not found');
      }
      return productAdapter.createProduct(user, product);
    },
  });

  return { products, isLoading, error, createProduct };
};

export const IOContextProvider = ({ productsAdapter, children }: { productsAdapter: ProductAdapter, children: React.ReactNode }) => {
  return <IOContext.Provider value={{ productAdapter: productsAdapter }}>{children}</IOContext.Provider>;
};

