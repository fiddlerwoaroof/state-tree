import { Map, fromJS } from 'immutable';

let Symbol = (window['Symbol'] !== undefined) ? window['Symbol'] : x => `_Symbol__${x}`;

export const fireListeners = Symbol('fireListeners');

const noOpTransform = val => val;

export function lensTransformer(
    lens,
    getTransform = noOpTransform,
    setTransform = noOpTransform
) {
    return {
        get: () => getTransform(lens.get()),
        set: (val) => lens.set(setTransform(val)),
        withValue(cb) {
            return cb(this.get());
        },

    };
}

export function makeLens(key, self) {
    const createLens = (keyPath) => {
        return {
            get() {
                let result = self._currentState.getIn(keyPath);
                if (result && result.toJS !== undefined) {
                    result = result.toJS();
                }
                return result;
            },
            set(val) {
                const oldState = self._currentState;

                if (self._currentState.getIn(keyPath) === undefined) {
                    for (let x = 0; x < keyPath.length; x++) {
                        const subPath = keyPath.slice(0, x);
                        if (self._currentState.getIn(subPath) === undefined && self._currentState.hasIn(subPath)) {
                            self._currentState = self._currentState.setIn(subPath, Map());
                        }
                    }
                }

                self._currentState = self._currentState.setIn(keyPath, fromJS(val));
                self[fireListeners](oldState, self._currentState);
            },
            lensFor(key) {
                let subPath = key instanceof Array ? key : [key];
                return createLens([...keyPath, ...subPath]);
            },

            withValue(cb, ...rest) {
                return cb(this.get(), ...rest);
            },

            swap(cb) {
                this.set(cb(this.get()));
                return this.get();
            }
        };
    };

    return createLens(key instanceof Array ? key : [key]);
}
