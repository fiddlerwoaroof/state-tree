import * as R from 'ramda';
import {
    Map,
    fromJS
} from 'immutable';
import { makeLens, lensTransformer, fireListeners } from './lens';

let common_state = {
    get(key) {
        return this.lensFor(key).get();
    },

    set(key, value) {
        this.lensFor(key).set(value);
    },

    getState() {
        return this._currentState.toJS();
    },

    lensFor(key) {
        return makeLens(key instanceof Array ? key : [key], this);
    },

    getRecorder() {
        return new RecordingStateContainer(this);
    },

    commit(recorder) {
        recorder.replay(this);
    },

    onUpdate(listener) {
        this.listeners.push(listener);
        return () => {
            this.listeners.splice(this.listeners.indexOf(listener), 1);
        };
    },

    [fireListeners](oldState, newState) {
        this.listeners.forEach((listener) => {
            listener(oldState, newState);
        });
    },
};

function RecordingStateContainer(container) {
    this.localStore = Map();
    this.container = container;
    this.listeners = [];
    this.actions = [];
}

RecordingStateContainer.prototype = Object.assign({
    setState(newState) {
        const oldState = this._currentState;
        this.localStore = this.localStore.merge(newState);
        this.actions = [[['setState', this.localStore]]];
        this[fireListeners](oldState, this._currentState);
    },

    get _currentState() {
        const con = new StateContainer(this.container.getState());
        this._replay(con);
        return con._currentState;
    },
    set _currentState(value) {
        this.setState(value);
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
}, common_state);

export { lensTransformer };

export default function StateContainer(data = {}) {
    var state = fromJS(data);

    return Object.assign({
        listeners: [],

        get _currentState() {
            return state;
        },
        set _currentState(value) {
            state = value;
        },

        /**
         * setState merges state shallowly
         * */
        setState(newState) {
            const oldState = this._currentState;
            this._currentState = this._currentState.merge(newState);
            this[fireListeners](oldState, this._currentState);
        },
    }, common_state);
}
