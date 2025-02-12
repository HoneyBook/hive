import { TestKit } from './test-kit';

export abstract class UITestKit<T> extends TestKit {
    abstract makeWrapper(): T
}
