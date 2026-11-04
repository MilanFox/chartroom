// happy-dom answers '' from Node.prototype's nodeName getter, which DOMPurify reads directly; defer to the subclass getter as browsers do.
Object.defineProperty(Node.prototype, 'nodeName', {
  configurable: true,
  get() {
    for (let prototype = Object.getPrototypeOf(this); prototype && prototype !== Node.prototype; prototype = Object.getPrototypeOf(prototype)) {
      const getter = Object.getOwnPropertyDescriptor(prototype, 'nodeName')?.get;
      if (getter) return getter.call(this);
    }
    return '';
  },
});
