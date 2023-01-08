export default {
  nodeResolve: true,
  port: 8000,
  preserveSymlinks: true,
  watch: true,
  plugins: [
    {
      name: 'custom-headers',
      transform(context) {
        context.set('Access-Control-Allow-Origin', '*');
        context.set('X-DevServer-Path', context.path);
      }
    }
  ]
};
