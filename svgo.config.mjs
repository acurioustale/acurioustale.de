// svgo normalises and optimises the SVGs. Pretty output keeps them readable so
// favicon.svg and the og-image source stay hand-editable.
export default {
  multipass: true,
  js2svg: { pretty: true, indent: 2 },
};
