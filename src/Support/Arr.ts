import Rand from 'rand-seed';

import Collection from './Collection';
import {
    dataGet, isUndefined, isNullOrUndefined, isObject, isString, isInstance,
    value
} from './helpers';

/**
 * Determine whether the given value is array accessible.
 *
 * @param {*} value
 * @returns {boolean}
 */
export const accessible = (value: any): boolean => (
    Array.isArray(value) || isObject(value)
);

/**
 * Set an object item to a given value using "dot" notation.
 *
 * If no key is given to the method, the entire object will be replaced.
 *
 * @param {Object} obj
 * @param {?string} key
 * @param {*} value
 * @returns {*}
 */
export const set = (obj: object, key: string | null, value: unknown): object | unknown => {
    if (key === null) return value;

    const keys = key.split('.');

    while (keys.length > 1) {
        key = keys.shift() as string;

        // If the key doesn't exist at this depth, we will just create an
        // empty array to hold the next value, allowing us to create the
        // arrays to hold final values at the correct depth. Then we'll keep
        // digging into the array.
        if (!Object.prototype.hasOwnProperty.call(obj, key) || !isObject(obj[key])) {
            obj[key] = {};
        }

        obj = obj[key];
    }

    obj[keys.shift() as string] = value;

    return obj;
};

/**
 * Add an element to an object using "dot" notation if it doesn't exist.
 *
 * @param {Object} obj
 * @param {string} key
 * @param {*} value
 * @returns {Object}
 */
export const add = (obj: object, key: string, value: any): object => {
    obj = {...obj};

    if (!Object.prototype.hasOwnProperty.call(obj, key)) {
        set(obj, key, value);
    }

    return obj;
};

/**
 * Collapse an array of arrays into a single array.
 *
 * @param {*[]} array
 * @returns {*[]}
 */
const _collapseArray = (array: unknown[]): unknown[] => {
    let results: unknown[] = [];

    for (let values of array) {
        values = values instanceof Collection ? values.all() : values;

        if (!Array.isArray(values)) continue;

        results = [...results, ...values];
    }

    return results;
};

/**
 * Collapse an object of objects into a single object.
 *
 * @param {Object} obj
 * @returns {Object}
 */
const _collapseObject = (obj: object): object => {
    let results: object = {};

    for (const key of Object.keys(obj)) {
        const values = obj[key] instanceof Collection ? obj[key].all() : obj[key];

        if (!isObject(values)) continue;

        results = {...results, ...values};
    }

    return results;
};

/**
 * Collapse an array of arrays into a single array.
 *
 * @param {*[]} items
 * @returns {(*[]|Object)}
 */
export const collapse = (items: unknown[] | object): unknown[] | object => {
    if (Array.isArray(items)) {
        return _collapseArray(items);
    }

    return _collapseObject(items);
};

/**
 * Cross join the given arrays, returning all possible permutations.
 *
 * @param {*[]} ...arrays
 * @returns {*[]}
 */
export const crossJoin = (...arrays: any[]): unknown[][] => {
    let results: any[][] = [[]];

    let index = 0;
    for (const array of arrays) {
        const append: any[] = [];

        for (const product of results) {
            // eslint-disable-next-line max-depth
            for (const item of array) {
                product[index] = item;

                append.push([...product]);
            }
        }

        results = append;
        index++;
    }

    return results;
};

/**
 * Divide an array or object into two arrays. One with keys and the other
 * with values.
 *
 * @param {(*[]|Object)} array
 * @returns {*[]}
 */
export const divide = (array: unknown[] | object): unknown[] => {
    if (Array.isArray(array)) {
        return [
            Array.from(Array(5), (x: undefined, i: number): number => i),
            [...array],
        ];
    }

    return [Object.keys(array), Object.values(array)];
};

/**
 * Flatten a multi-dimensional object with dots.
 *
 * @param {Object} obj
 * @param {string} prepend
 * @returns {Object}
 */
export const dot = (obj: object, prepend = ''): object => {
    let results = {};

    for (const key of Object.keys(obj)) {
        if (isObject(obj[key]) && Object.keys(obj[key]).length) {
            results = {...results, ...dot(obj[key], `${prepend}${key}.`)};
        } else {
            results[`${prepend}${key}`] = obj[key];
        }
    }

    return results;
};

/**
 * Determine if the given key exists in the provided array.
 *
 * @param {(*[]|Object)} array
 * @param {(number|string)} key
 * @returns {boolean}
 */
export const exists = (array: unknown[] | object, key: number | string): boolean => {
    if (Array.isArray(array)) {
        return key >= 0 && key < array.length;
    }

    return Object.prototype.hasOwnProperty.call(array, key);
};

/**
 * If the given value is not an array and not null, wrap it in one.
 *
 * @param {*} value
 * @returns {*[]}
 */
export const wrap = (value: unknown): any[] => {
    if (isNullOrUndefined(value)) {
        return [];
    }

    return Array.isArray(value) ? [...value] : [value];
};

/**
 * Remove one or many object properties from a given object using "dot"
 * notation.
 *
 * @param {Object} obj
 * @param {?(string[]|string|undefined)} keys
 * @returns {void}
 */
export const forget = (obj: object, keys?: string[] | string): void => {
    const original = obj;

    keys = wrap(keys) as string[];

    if (keys.length === 0) return;

    // eslint-disable-next-line no-labels
    loop1:
    for (const key of keys) {
        // If the exact key exists in the top-level, remove it
        if (exists(obj, key)) {
            delete obj[key];

            continue;
        }

        const parts = key.split('.');

        // Clean up before each pass
        obj = original;

        while (parts.length > 1) {
            const part = parts.shift() as string;

            // eslint-disable-next-line max-depth
            if (Object.prototype.hasOwnProperty.call(obj, part) && isObject(obj[part])) {
                obj = obj[part];
            } else {
                continue loop1;
            }
        }

        delete obj[parts.shift() as string];
    }
};

/**
 * Get all of the given object except for a specified array of keys.
 *
 * @param {Object} obj
 * @param {(string[]|string)} keys
 * @returns {Object}
 */
export const except = (obj: object, keys: string[] | string): object => {
    obj = {...obj};

    forget(obj, keys);

    return obj;
};

/**
 * Return the first element in an array passing a given truth test.
 *
 * @param {*[]} array
 * @param {?(Function|undefined)} callback
 * @param {(*|undefined)} dflt
 * @returns {*}
 */
const _firstArray = (array: unknown[], callback?: Function | null, dflt?: unknown): unknown => {
    if (isNullOrUndefined(callback)) {
        if (!array.length) return value(dflt);

        for (const item of array) return item;
    }

    let index = 0;
    for (const value of array) {
        if ((callback as Function)(value, index)) return value;
        index++;
    }

    return value(dflt);
};

/**
 * Return the first element in an array passing a given truth test.
 *
 * @param {Object} obj
 * @param {?(Function|undefined)} callback
 * @param {(*|undefined)} dflt
 * @returns {*}
 */
const _firstObject = (obj: object, callback?: Function | null, dflt?: unknown): unknown => {
    if (isNullOrUndefined(callback)) {
        const keys = Object.keys(obj);

        if (!keys.length) return value(dflt);

        for (const key of keys) return obj[key];
    }

    for (const key of Object.keys(obj)) {
        if ((callback as Function)(value, key)) return value;
    }

    return value(dflt);
};

/**
 * Return the first element in an array or object passing a given truth test.
 *
 * @param {(Array|Object)} items
 * @param {?(Function|undefined)} callback
 * @param {(*|undefined)} dflt
 * @returns {*}
 */
export const first = (items: unknown[] | object, callback?: Function | null,
    dflt?: unknown): unknown => {
    if (Array.isArray(items)) {
        return _firstArray(items, callback, dflt);
    }

    return _firstObject(items, callback, dflt);
};

/**
 * Return the last element in an array passing a given truth test.
 *
 * @param {(Array|Object)} items
 * @param {?(Function|undefined)} callback
 * @param {(*|undefined)} dflt
 * @returns {*}
 */
export const last = (items: unknown[] | object, callback?: Function | null,
    dflt?: unknown): any => {
    if (isNullOrUndefined(callback)) {
        if (Array.isArray(items)) {
            return items.length ? items[items.length - 1] : value(dflt);
        }

        const keys = Object.keys(items);

        return keys.length ? items[keys[keys.length - 1]] : value(dflt);
    }

    if (Array.isArray(items)) {
        return first(items.reverse(), callback, dflt);
    }

    return first(
        Object.keys(items)
            .reverse()
            .reduce((acc: object, key: string): object => {
                acc[key] = items[key];

                return acc;
            }, {}),
        callback,
        dflt
    );
};

/**
 * Flatten a multi-dimensional array into a single level.
 *
 * @param {(*[]|Object)} array
 * @param {number} depth
 * @returns {*[]}
 */
export const flatten = (array: unknown[] | object, depth = Infinity): unknown[] => {
    let result: unknown[] = [];

    const arr = Array.isArray(array) ? array : Object.values(array);

    for (let item of arr) {
        item = item instanceof Collection ? item.all() : item;

        if (!Array.isArray(item) && !(isObject(item) && !isInstance(item))) {
            result.push(item);
        } else if (depth === 1) {
            result = [
                ...result,
                ...(Array.isArray(item) ? item : Object.values(item))
            ];
        } else {
            result = [...result, ...flatten(item, depth - 1)];
        }
    }

    return result;
};

/**
 * Get an item from an array using "dot" notation.
 *
 * @param {Object} obj
 * @param {(string|undefined)} key
 * @param {(*|undefined)} dflt
 * @returns {*}
 */
export const get = (obj: object, key?: string, dflt?: unknown): unknown => {
    if (!accessible(obj)) return value(dflt);

    if (isNullOrUndefined(key)) return obj;

    key = key as string;

    if (exists(obj, key)) return obj[key];

    if (key.indexOf('.') < 0) {
        return Object.prototype.hasOwnProperty.call(obj, key) ? obj[key] : value(dflt);
    }

    for (const segment of key.split('.')) {
        if (accessible(obj) && exists(obj, segment)) {
            obj = obj[segment];
        } else {
            return value(dflt);
        }
    }

    return obj;
};

/**
 * Check if an array has any elements or an object has any properties.
 *
 * @param {(*[]|Object)} array
 * @returns {boolean}
 */
export const empty = (array: unknown[] | object): boolean => {
    return !(
        Array.isArray(array) ? array.length : Object.keys(array).length
    );
};

/**
 * Check if an item or items exist in an array using "dot" notation.
 *
 * @param {?Object} obj
 * @param {(string[]|string)|undefined} keys
 * @returns {boolean}
 */
export const has = (obj?: object, keys?: string[] | string): boolean => {
    if (isNullOrUndefined(keys)) return false;

    keys = wrap(keys) as string[];

    if (!obj) return false;

    if (!keys.length) return false;

    for (const key of keys) {
        let subKeyObj = obj;

        if (exists(obj, key)) continue;

        for (const segment of key.split('.')) {
            // eslint-disable-next-line max-depth
            if (accessible(subKeyObj) && exists(subKeyObj, segment)) {
                subKeyObj = subKeyObj[segment];
            } else {
                return false;
            }
        }
    }

    return true;
};

/**
 * Get a subset of the items from the given array.
 *
 * @param {Object} obj
 * @param {(*[]|string)} keys
 * @returns {Object}
 */
export const only = (obj: object, keys: unknown[] | string): object => {
    keys = wrap(keys);

    return Object(keys).reduce((acc: object, key: string): object => {
        if (keys.includes(key)) acc[key] = obj[key];

        return acc;
    }, {});
};

/**
 * Explode the "value" and "key" arguments passed to "pluck".
 *
 * @param {?(string[]|string)} value
 * @param {(string[]|string|undefined)} key
 * @returns {*}
 */
const _explodePluckParameters = (value: string[] | string | null,
    key?: string[] | string): any => {
    value = isString(value) ? value.split('.') : value;

    key = isNullOrUndefined(key) || Array.isArray(key) ? key : key.split('.');

    return [value, key];
};

/**
 * Pluck an array of values from an array.
 *
 * @param {*[]} array
 * @param {?(string[]|string)} value
 * @param {(string[]|string|undefined)} key
 * @returns {(*[]|Object)}
 */
export const pluck = (array: unknown[], value: string | string[] | null, key?: string | string[]): unknown[] | object => {
    [value, key] = _explodePluckParameters(value, key);

    const results = isNullOrUndefined(key) ? [] : {};

    for (const item of array) {
        const itemValue = dataGet(item, value);

        // If the key is "null" or "undefined", we will just append the
        // value to the array and keep looping. Otherwise we will key the
        // array using the value of the key we received from the developer.
        // Then we'll return the final array form.
        if (isNullOrUndefined(key)) {
            (results as unknown[]).push(itemValue);
        } else {
            const itemKey = dataGet(item, key as string | string[]);

            results[itemKey] = itemValue;
        }
    }

    return results;
};

/**
 * Push an item onto the beginning of an array / object.
 *
 * @param {(*[]|Object)} array
 * @param {*} value
 * @param {(string|undefined)} key
 * @returns {(*[]|Object)}
 */
export const prepend = (array: unknown[] | object, value: unknown, key?: string): unknown[] | object => {
    if (isUndefined(key) && Array.isArray(array)) {
        array = [value, ...array];
    } else if (isObject(array)) {
        array = {...array, [key as string]: value};
    }

    return array;
};

/**
 * Get a value from the array, and remove it.
 *
 * @param {(Array|Object)} items
 * @param {(string|number)} key
 * @param {(*|undefined)} dflt
 * @returns {*}
 */
export const pull = (items: unknown[] | object, key: string | number, dflt?: unknown): unknown => {
    if (Array.isArray(items)) {
        const value = items.splice(key as number, 1)[0];

        return isUndefined(value) ? dflt : value;
    }

    const value = get(items, key as string, dflt);

    forget(items, key as string);

    return value;
};

/**
 * Return a new array that contains the given number of shuffled elements
 * from the original array.
 *
 * @param {*[]} array
 * @returns {*[]}
 */
const _shuffle = (array: unknown[]): any[] => {
    array = [...array];

    let currentIndex = array.length;
    let temporaryValue: unknown;
    let randomIndex: number;

    // While there remain elements to shuffle
    while (currentIndex !== 0) {
        // Pick a remaining element
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex -= 1;

        // And swap it with the current element
        temporaryValue = array[currentIndex];
        array[currentIndex] = array[randomIndex];
        array[randomIndex] = temporaryValue;
    }

    return array;
};

/**
 * Get one or a specified number of random values from an array.
 *
 * @param {*[]} array
 * @param {(number|undefined)} number
 * @returns {*}
 *
 * @throws {Error}
 */
export const random = (array: unknown[], number?: number): any => {
    const requested = (isNullOrUndefined(number) ? 1 : number) as number;

    const count = array.length;

    if (requested > count) {
        throw new Error(`You requested ${requested} items, but there are only ${count} items available.`);
    }

    if (isUndefined(number)) {
        return array[Math.floor(Math.random() * array.length)];
    }

    if (number === 0) return [];

    const keys = _shuffle(
        Array.from(Array(number), (x: undefined, i: number): number => i)
    );

    const results = [];

    for (const key of keys) results.push(array[key as number]);

    return results;
};

/**
 * Shuffle the given array and return the result.
 *
 * @param {*[]} array
 * @param {(string|undefined)} seed
 * @returns {*[]}
 */
const _shuffleArray = (array: unknown[], seed?: string): unknown[] => {
    if (isUndefined(seed)) {
        return _shuffle(array);
    }

    const rand = new Rand(seed);
    array = [...array];
    array.sort((): number => Math.floor(rand.next() * 2 - 1));

    return array;
};

/**
 * Shuffle the given array and return the result.
 *
 * @param {Object} obj
 * @param {(string|undefined)} seed
 * @returns {Object}
 */
const _shuffleObject = (obj: object, seed?: string): object => {
    if (isUndefined(seed)) {
        const keys = _shuffle(Object.keys(obj));

        return keys.reduce((acc: object, key: string): object => {
            acc[key] = obj[key];

            return acc;
        }, {});
    }

    const rand = new Rand(seed);
    const keys = Object.keys(obj);

    return keys
        .sort((): number => Math.floor(rand.next() * 2 - 1))
        .reduce((acc: object, key: string): object => {
            acc[key] = obj[key];

            return acc;
        }, {});
};

/**
 * Shuffle the given array or object and return the result.
 *
 * @param {(Array|Object)} items
 * @param {(string|undefined)} seed
 * @returns {*[]}
 */
export const shuffle = (items: unknown[] | object, seed?: string): unknown[] | object => {
    if (Array.isArray(items)) {
        return _shuffleArray(items, seed);
    }

    return _shuffleObject(items, seed);
};

/**
 * Recursively sort an array by keys and values.
 *
 * @param {(*[]|Object)} array
 * @returns {(*[]|Object)}
 */
export const sortRecursive = (array: unknown[] | object): unknown[] | object => {
    if (Array.isArray(array)) {
        const arr = array.reduce((acc: unknown[], value: any): unknown[] => {
            acc.push(accessible(value) ? sortRecursive(value) : value);

            return acc;
        }, []);

        return arr.sort();
    }

    const obj = Object.keys(array)
        .reduce((acc: object, key: string): object => {
            acc[key] = accessible(array[key])
                ? sortRecursive(array[key])
                : array[key];

            return acc;
        }, {});

    return Object.keys(obj)
        .sort()
        .reduce((acc: object, key: string): object => {
            acc[key] = obj[key];

            return acc;
        }, {});
};

/**
 * Convert the array into a query string.
 *
 * @param {Object} obj
 * @returns {string}
 */
export const query = (obj: object): string => {
    /**
     * Replace any spaces with '%20'.
     *
     * @param {string} str
     * @returns {string}
     */
    const replaceSpaces = (str: string): string => str.replace(/ /g, '%20');

    const str = Object.keys(obj)
        .reduce((acc: string, key: string): string => {
            return `${acc}&${replaceSpaces(key)}=${replaceSpaces(obj[key])}`;
        }, '');

    return str.slice(1).replace(/[!'()*]/g, (c: string): string => (
        `%${c.charCodeAt(0).toString(16)}`
    ));
};

/**
 * Filter the array using the given callback.
 *
 * @param {(*[]|Object)} array
 * @param {Function} callback
 * @returns {(*[]|Object)}
 */
export const where = (array: unknown[] | object, callback: any): unknown[] | object => {
    if (Array.isArray(array)) {
        return array.filter(
            (value: unknown, index: number, array: unknown[]): boolean => (
                callback(value, index, array)
            )
        );
    }

    return Object.keys(array)
        .filter((key: string): boolean => callback(array[key], key, array))
        .reduce((acc: object, key: string): object => {
            acc[key] = array[key];

            return acc;
        }, {});
};
