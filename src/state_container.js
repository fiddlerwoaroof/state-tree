import * as R from 'ramda';
import {
    Map,
    fromJS
} from 'immutable';

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

let Symbol = (window['Symbol'] !== undefined) ? window['Symbol'] : x => `_Symbol__${x}`;

let fireListeners = Symbol('fireListeners');

function makeLens(key, self) {
    const createLens = (keyPath) => {
        const lens = R.lensPath(keyPath);

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

            withValue(cb) {
                return cb(this.get());
            }
        };
    };

    return createLens(key instanceof Array ? key : [key]);
};


function RecordingStateContainer(container) {
    this.localStore = Map();
    this.container = container;
    this.listeners = [];
    this.actions = [];
};


RecordingStateContainer.prototype = {
    set(key, value) {
        this.lensFor(key).set(value);
    },

    get(key) {
        return this.lensFor(key).get();
    },

    setState(newState) {
        this.localStore = this.localStore.merge(newState);
        this.actions = [
            [
                ['setState', this.localStore]
            ]
        ];
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

export default function StateContainer(data = {}, computed = {}) {


    var listeners = [];
    var state = [fromJS(data)];

    function fireListeners(oldState, newState) {
        listeners.forEach((listener) => {
            listener(oldState, newState);
        });
    }

    return {
        lensFor(key) {
            let self = this;
            const createLens = (keyPath) => {
                const lens = R.lensPath(keyPath);

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
                        fireListeners(oldState, self._currentState);
                    },
                    lensFor(key) {
                        let subPath = key instanceof Array ? key : [key];
                        return createLens([...keyPath, ...subPath]);
                    },

                    withValue(cb) {
                        return cb(this.get());
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
            let mergedState;

            this._currentState = this._currentState.merge(newState);

            fireListeners(oldState, this._currentState);
        },
        beforeUpdate(listener) {

        },
        onUpdate(listener) {
            listeners.push(listener);
            return function () {
                listeners = listeners.splice(listeners.indexOf(listener), 1);
            };
        }
    };
}
