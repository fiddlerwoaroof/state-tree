import * as R from 'ramda';
import {
    Map,
    fromJS
} from 'immutable';

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
                let result = self._getState().getIn(keyPath);
                if (result && result.toJS !== undefined) {
                    result = result.toJS();
                }
                return result;
            },
            set(val) {
                const oldState = self._getState();

                self.localStore = self.localStore.setIn(keyPath, fromJS(val));
                this._addSetAction(keyPath, R.clone(val));

                self[fireListeners](oldState, self._getState());
            },

            _prepareForSet(keyPath) {
                if (self.localStore.getIn(keyPath) === undefined) {
                    for (let x = 0; x < keyPath.length; x++) {
                        const subPath = keyPath.slice(0, x);
                        if (self.localStore.getIn(subPath) === undefined && self.localStore.hasIn(subPath)) {
                            self.localStore = self.localStore.setIn(subPath, Map());
                        }
                    }
                }
            },

            _addSetAction(keyPath, val) {
                let lastAction = self.actions[self.actions.length - 1];
                if (lastAction && (lastAction[0][0] === 'lensFor') && R.equals(lastAction[0][1], keyPath)) {
                    self.actions.pop();
                }

                self.actions.push([
                    ['lensFor', keyPath],
                    ['set', val]
                ]);
            },

            lensFor(key) {
                let subPath = key instanceof Array ? key : [key];
                return createLens([...keyPath, ...subPath]);
            },

            withValue(cb, ...additional) {
                return cb(this.get(), ...additional);
            },

            swap(cb) {
                this.set(cb(this.get()));
                return this.get();
            }
        };
    };

    return createLens(key instanceof Array ? key : [key]);
}