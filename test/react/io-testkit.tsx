import {Kit} from '../../src/kit';
import {aProduct, IOContextProvider, Product, ProductAdapter, UserProducts} from "./products";
import React, {PropsWithChildren} from "react";
import {AuthTestKit} from "./auth-testkit";
import {User} from "./auth";

export class MemoryProductAdapter implements ProductAdapter {

  constructor(readonly products: UserProducts = new Map()) {
  }

  async createProduct(userId: User["id"], product: Omit<Product, 'id'>): Promise<string> {
    const id = crypto.randomUUID();
    this.products.set(userId, [...this.products.get(userId) || [], {...product, id}]);
    return id;
  }

  async getProducts(userId: User["id"]): Promise<Product[]> {
    return this.products.get(userId) || [];
  }

}

export class IOTestKit extends Kit {
  result = {
    productAdapter: new MemoryProductAdapter()
  }

  name = "IOTestKit";

  constructor() {
    super({dependentKitsClasses: [AuthTestKit]});
  }

  init() {
    const {
      AuthTestKit: { result: { user } }
    } = this.getDependentKits<[AuthTestKit]>();

    this.result.productAdapter.products.set(user.id, [aProduct(), aProduct()]);
  }

  withUserProducts(userId: string, products: Product[]): void {
    this.result.productAdapter.products.set(userId, products);
  }

  get Provider(): React.FC<PropsWithChildren> {
    return ({children}) =>
        <IOContextProvider productsAdapter={this.result.productAdapter}>{children}</IOContextProvider>;
  }
}