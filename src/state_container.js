import * as R from 'ramda';
import {
    Map,
    fromJS
} from 'immutable';
import { makeLens, lensTransformer, fireListeners } from './lens';

function RecordingStateContainer(container) {
    this.localStore = Map();
    this.container = container;
    this.listeners = [];
    this.actions = [];
}

RecordingStateContainer.prototype = {
    set(key, value) { this.lensFor(key).set(value); },

    get(key) { return this.lensFor(key).get(); },

    setState(newState) {
        this.localStore = this.localStore.merge(newState);
        this.actions = [ [ ['setState', this.localStore] ] ];
    },

    _getState() {
        const con = new StateContainer(this.container.getState());
        this._replay(con);
        return con._currentState;
    },

    getState() {
        return this._getState().toJS();
    },

    lensFor(key) {
        return makeLens(key, this);
    },
    _replay(container) {
        R.forEach(
            R.reduce(
                (cur, [key, ...args]) => cur[key](...args),
                container,
                R.__
            ),
            this.actions
        );
    },
    replay(container) {
        if (container !== this.container) {
            throw new Error("Trying to replay into wrong parent container");
        }
        this._replay(container);
        this.localStore = Map();
        this.actions = [];
    },
    onUpdate(listener) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.splice(this.listeners.indexOf(listener), 1);
        };
    },
    [fireListeners](oldState, newState) {
        this.listeners.forEach((listener) => {
            listener(oldState, newState);
        });
    },

    getRecorder() {
        return new RecordingStateContainer(this);
    },

    commit(recorder) {
        recorder.replay(this);
    },

};

export { lensTransformer };

export default function StateContainer(data = {}) {


    var listeners = [];
    var state = [fromJS(data)];

    return {
        [fireListeners](oldState, newState) {
            listeners.forEach((listener) => {
                listener(oldState, newState);
            });
        },

        lensFor(key) {
            let self = this;
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

                    withValue(cb) {
                        return cb(this.get());
                    },

                    swap(cb) {
                        this.set(cb(this.get()));
                        return this.get();
                    }
                };
            };

            return createLens(key instanceof Array ? key : [key]);
        },

        get _currentState() {
            return state[state.length - 1];
        },
        set _currentState(value) {
            state[state.length - 1] = value;
        },

        get(key) {
            return this.lensFor(key).get();
        },

        set(key, value) {
            this.lensFor(key).set(value);
        },

        getState() {
            return this._currentState.toJS();
        },

        getRecorder() {
            return new RecordingStateContainer(this);
        },

        commit(recorder) {
            recorder.replay(this);
        },

        /**
         * setState merges state shallowly
         * */
        setState(newState) {
            const oldState = this._currentState;

            this._currentState = this._currentState.merge(newState);

            this[fireListeners](oldState, this._currentState);
        },
        onUpdate(listener) {
            listeners.push(listener);
            return function () {
                listeners = listeners.splice(listeners.indexOf(listener), 1);
            };
        }
    };
}
