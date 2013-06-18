Package.describe({
  summary: 'Routing for Meteor'
});

Package.on_use(function (api) {
  api.use([
    'deps',
    'underscore'
  ], 'client');

  api.add_files([
    'lib/path.js',
    'lib/route_context.js',
    'lib/route.js',
    'lib/route_handlers/simple_route_handler.js',
    'lib/router.js',
  ], ['client', 'server']);

  api.add_files([
    'lib/client/router.js'
  ], 'client');
});

Package.on_test(function (api) {
  api.use('router', 'client');
  api.use('reactive-dict', 'client');
  api.use('tinytest', 'client');
  api.use('test-helpers', 'client');
  api.add_files('test/router_tests.js', 'client');
});