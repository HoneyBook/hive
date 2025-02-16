import { Kit } from './kit';

export abstract class UIKit<T> extends Kit {
    abstract makeWrapper(): T
}
