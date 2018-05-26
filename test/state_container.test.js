import StateContainer, {lensTransformer} from '../src/state_container';
import sinon from 'sinon';

test("initial state setting works", () => {
   const container = new StateContainer({foo: 'bar'});

   expect(container.get('foo')).toBe('bar')//, 'get works with initial data');
   expect(container.getState().foo).toBe('bar')//, 'getState works with initial data');
});

test("set updates state", () => {
    const container = new StateContainer({foo: 'bar'});

    container.set('foo', 'baz');
    expect(container.get('foo')).toBe('baz')//, 'set updated the data');

});

test("setState updates state", () => {
    const container = new StateContainer({foo: 'bar', moo: 'cow'});

    container.setState({foo: 'baz'});
    expect(container.get('foo')).toBe('baz')//, 'setState updated the data');
    expect(container.get('moo')).toBe('cow')//, 'setState did not lose data');

});

test("returned state cannot modify internal state", () => {
    const container = new StateContainer({foo: 'bar'});

    const outputState = container.getState();
    expect(container.get('foo')).toBe(outputState.foo)//, "output state matches container initially");

    outputState.foo = 'moo';
    expect(container.get('foo')).toBe('bar')//, "container state was not modified by output state");
});

test("onUpdate listeners are fired when set is called", () => {
    let container, listener;

    container = new StateContainer({foo: 'bar'});
    listener = sinon.spy();

    container.onUpdate(listener);

    container.set('foo', 'hi');

    expect(JSON.stringify(listener.args[0])).toBe(JSON.stringify([{foo: 'bar'}, {foo: 'hi'}]));

    container = new StateContainer({foo: 'bar'});
    const recorder = container.getRecorder();
    listener = sinon.spy();

    recorder.onUpdate(listener);

    recorder.set('foo', 'hi');

    expect(JSON.stringify(listener.args[0])).toBe(JSON.stringify([{foo: 'bar'}, {foo: 'hi'}]));
});

test("onUpdate listeners are fired when setState is called", () => {
    const container = new StateContainer({foo: 'bar'});
    const listener = sinon.spy();

    container.onUpdate(listener);

    container.setState({'foo': 'hi'});

    expect(JSON.stringify(listener.args[0]))
        .toBe(JSON.stringify(
            [{ foo: 'bar' },
             { foo: 'hi' }]
        ));
});

test("recording works", () => {
    const container = new StateContainer({foo: 'bar'});

    const recorder = container.getRecorder();

    // recorder mirrors container
    container.set('foo', 3);
    expect(recorder.get('foo')).toBe(3);

    // copy on write - reads from local
    recorder.set('foo', 4);
    expect(recorder.get('foo')).toBe(4);
    expect(container.get('foo')).toBe(3);

    // copy on write - does not read from parent
    container.set('foo', 5);
    expect(recorder.get('foo')).toBe(4);

    container.commit(recorder);
    expect(container.get('foo')).toBe(4)//, 'changes commited affect parent');

    // after committing, reflects parent again
    container.set('foo', 5);
    expect(recorder.get('foo')).toBe(5);

    // getState works?
    let theState = recorder.getState();
    expect(theState).toEqual({foo: 5});

    recorder.setState({bar: 7});
    expect(recorder.getState()).toEqual({foo: 5, bar: 7});
    expect(container.getState()).toEqual({foo: 5});

    container.commit(recorder);
    expect(container.getState()).toEqual({foo: 5, bar: 7});

    // cannot commit a recorder into wrong container
    const otherContainer = new StateContainer({foo: 'bar'});
    let err = 42;
    try {
        otherContainer.commit(recorder);
    } catch (e) {
        err = e;
    }
    expect(err instanceof Error).toBe(true)//, 'throws an error on invalid commit');
});

test("recorder getState works as expected", () => {
    let container = new StateContainer({foo: {bar: 1, baz: 1}});
    let recorder = container.getRecorder();

    let lens = recorder.lensFor('foo');
    lens.set({bar: 2});

    expect(recorder.getState()).toEqual({foo: {bar: 2}}, 'replaces when set with complex value');

    container = new StateContainer({foo: {bar: 1, baz: 1}});
    recorder = container.getRecorder();
    lens = recorder.lensFor(['foo', 'bar']);

    lens.set(2);
    expect(recorder.getState()).toEqual({foo: {bar: 2, baz: 1}}, 'updates when set with simple value');

});
test("recorder playback works correctly", () => {
    let container = new StateContainer({foo: {bar: 1, baz: 1}});
    let recorder = container.getRecorder();

    let lens = recorder.lensFor('foo');
    lens.set({bar: 2});

    container.commit(recorder);
    expect(container.getState()).toEqual({foo: {bar: 2}}, 'replaces when set with complex value');

    container = new StateContainer({foo: {bar: 1, baz: 1}});
    recorder = container.getRecorder();
    lens = recorder.lensFor(['foo', 'bar']);

    lens.set(2);
    container.commit(recorder);
    expect(container.getState()).toEqual({foo: {bar: 2, baz: 1}}, 'updates when set with simple value');
});

test("recorder from recorder also records - infinite turtles", () => {
    let container = new StateContainer({foo: {bar: 1, baz: 1}});
    let recorder = container.getRecorder();
    let subRecorder = recorder.getRecorder();


    subRecorder.set(['foo', 'bar'], 2);
    recorder.commit(subRecorder);

    expect(subRecorder.get(['foo', 'bar'])).toBe(2);
    recorder.set(['foo', 'bar'], 3);
    expect(subRecorder.get(['foo', 'bar'])).toBe(3);
});

test("recorder from recorder also records - infinite turtles", () => {
    let container = new StateContainer({foo: {bar: 1, baz: 1}});
    let recorder = container.getRecorder();
    let subRecorder = recorder.getRecorder();


    expect(subRecorder.get(['foo', 'bar'])).toBe(1);
    subRecorder.set(['foo', 'bar'], 2);

    expect(subRecorder.get(['foo', 'bar'])).toBe(2);
    expect(recorder.get(['foo', 'bar'])).toBe(1);
    expect(container.get(['foo', 'bar'])).toBe(1);

    recorder.commit(subRecorder);

    expect(subRecorder.get(['foo', 'bar'])).toBe(2);
    expect(recorder.get(['foo', 'bar'])).toBe(2);
    expect(container.get(['foo', 'bar'])).toBe(1);

    container.commit(recorder);
    expect(subRecorder.get(['foo', 'bar'])).toBe(2);
    expect(recorder.get(['foo', 'bar'])).toBe(2);
    expect(container.get(['foo', 'bar'])).toBe(2);

    container.set(['foo', 'bar'], 3);
    expect(subRecorder.get(['foo', 'bar'])).toBe(3);
});

test("lenses work", () => {
    const container = new StateContainer({foo: {bar: 1, baz: 2}});
    let lens, sublens;

    lens = container.lensFor('foo');
    expect(lens.get()).toEqual({bar:1, baz: 2});

    sublens = lens.lensFor('bar');
    expect(sublens.get()).toBe(1);

    sublens.set(2);
    expect(sublens.get()).toBe(2, 'changing a nested lens updates its value');
    expect(lens.get()).toEqual({bar:2, baz: 2}, 'changing a nested lens updates its parent\'s value');
    expect(container.getState()).toEqual({foo: {bar:2, baz: 2}}, 'changing a nested lens updates container state');

    lens.set({bar: 3});
    expect(sublens.get()).toBe(3, 'changing parent lens to complex value updates nested lens value');
    expect(lens.get()).toEqual({bar:3}, 'changing parent lens to complex value updates itself');
    expect(container.getState()).toEqual({foo: {bar:3}}, 'changing parent lens to complex value updates container');

    lens.set(3);
    expect(lens.get()).toBe(3);
    expect(container.getState()).toEqual({foo: 3});
});

test("lenses treat undefined properly", () => {
    let container = new StateContainer({foo: undefined});
    let lens, sublens, recorder;

    lens = container.lensFor('foo');
    expect(lens.get()).toEqual(undefined);

    sublens = lens.lensFor('bar');
    expect(sublens.get()).toBe(undefined);

    try {
        sublens.set(2);
    } catch (e) {
        // nothing
    }
    expect(sublens.get()).toBe(2, 'changing a nested lens updates its value');
    expect(lens.get()).toEqual({bar:2}, 'changing a nested lens updates its parent\'s value');
    expect(container.getState()).toEqual({foo: {bar:2}}, 'changing a nested lens updates container state');

    container = new StateContainer({foo: undefined});
    recorder = container.getRecorder();
    lens = recorder.lensFor(['foo', 'bar']);

    try {
        lens.set(2);
    } catch (e) {
        // nothing
    }
    expect(lens.get()).toBe(2, 'changing a lens updates its value');

    container = new StateContainer({foo: {bar: undefined, qwerty: 2}});
    recorder = container.getRecorder();
    lens = recorder.lensFor(['foo', 'bar', 'baz']);

    try {
        lens.set(2);
    } catch (e) {
        // nothing
    }
    
    expect(lens.get()).toBe(2, 'changing a lens updates its value');
    expect(recorder.getState()).toEqual({foo: {bar: {baz: 2}, qwerty: 2}});
    container.commit(recorder);
    expect(container.getState()).toEqual({foo: {bar: {baz: 2}, qwerty: 2}});
});

test('returned values are just Javascript objects', () => {
    const container = new StateContainer({foo: {bar: {baz: 1}}});
    const recorder = container.getRecorder();

    expect(container.get('foo').bar).toEqual({baz: 1});
    expect(recorder.get('foo').bar).toEqual({baz: 1});

});

test("lensFor accepts array paths", () => {
    const container = new StateContainer({foo: {bar: 1, baz: {'qwerty': 2}}});
    let lens, sublens;

    lens = container.lensFor(['foo', 'bar']);
    expect(lens.get()).toBe(1);
    lens.set(2);
    expect(lens.get()).toBe(2);

    lens = container.lensFor('foo').lensFor(['baz', 'qwerty']);
    expect(lens.get()).toBe(2);
});

test("lensFor accepts objects nested in array paths", () => {
    const container = new StateContainer({foo: {bar: 1, baz: {}}});
    let lens;

    lens = container.lensFor('foo').lensFor(['baz', 'qwerty', 0, 'asdf']);
    lens.set(2);
    expect(lens.get()).toBe(2);
});

test("lensFor indexes into arrays", () => {
    const container = new StateContainer({foo: {bar: [1], baz: {'qwerty': 2}}});
    let lens, sublens;

    lens = container.lensFor(['foo', 'bar']).lensFor(0);
    expect(lens.get()).toBe(1);
    lens.set(2);
    expect(lens.get()).toBe(2);

    lens = container.lensFor(['foo', 'bar']).lensFor(2);
    lens.set(3);
    expect(lens.get()).toBe(3);
});

test("lens transformers work", () => {
    const container = new StateContainer({foo: {bar: 1, baz: {'qwerty': 2}}});
    let lens, transformer;

    lens = container.lensFor(['foo', 'bar']);
    transformer = lensTransformer(
        lens,
        v => v * 2,
        v => v / 2
    );

    expect(transformer.get()).toBe(2);
    transformer.set(4);
    expect(transformer.get()).toBe(4);
});
