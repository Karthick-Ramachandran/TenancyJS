// The factory itself throws while building the runtime — the loader must wrap
// this distinctly from a top-level load failure.
export default () => {
  throw new Error("factory failed building runtime for postgres://secret");
};
