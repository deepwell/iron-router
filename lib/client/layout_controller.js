var getTemplateFunction = function (template, defaultFn) {
  if (_.isFunction(template))
    return template;
  else if (Template[template])
    return Template[template];
  else if (defaultFn)
    return defaultFn;
  else
    throw new Error('Oops, no template found named "' + template + '"');
};

var assertTemplateExists = function (template) {
  if (_.isFunction(template))
    return true;
  else if (!Template[template])
    throw new Error('Uh oh, no template found named "' + template + '"');
};

var ReactiveVar = function (value) {
  this._dep = new Deps.Dependency;
  this._value = value || null;
};

ReactiveVar.prototype = {
  set: function (value) {
    if (EJSON.equals(value, this._value))
      return;

    this._value = value;
    this._dep.changed();
  },

  get: function () {
    this._dep.depend();
    return this._value;
  },

  equals: function (other) {
    this._dep.depend();
    return EJSON.equals(this._value, other);
  }
};

LayoutController = function () {
  this.templates = new ReactiveDict;
  this.layout = new ReactiveVar;
  this.data = new ReactiveVar({});
  this.layout.set('__defaultLayout__');
  this._yields = {};
};

LayoutController.prototype = {
  setLayout: function (layout) {
    var self = this;
    assertTemplateExists(layout);

    Deps.nonreactive(function () {
      var oldLayout = self.layout.get();

      // reset because we have a new layout now
      if (oldLayout !== layout)
        self._yields = {};
    });

    this.layout.set(layout);
  },

  setTemplate: function (template, to) {
    var self = this;

    to = to || '__main__';
    assertTemplateExists(template);

    // make sure the yield region was declared otherwise the user may have
    // tried to render into a named yield that was never declared in the
    // layout. Let's provide them a helpful warning if that happens.

    // If we're already in a flush we want to schedule the yield check for after
    // the next flush, not this one. The flush we're currently in is caused by a
    // location change which triggers the router's dispatch process. Then, we
    // add this check to the current flush's afterFlushCallbacks queue which
    // caues it to be executed as soon as all our code is done running, instead
    // of after the next flush which is what we want. There might be a better
    // pattern here.
    Meteor.defer(function () {
      Deps.afterFlush(function () {
        var isYieldDeclared = self._yields[to];
        var help;

        if (!isYieldDeclared) {
          if (to == '__main__')
            help = 'Sorry, couldn\'t find the main yield. Did you define it in one of the rendered templates like this: {{yield}}?';
          else
            help = 'Sorry, couldn\'t find a yield named "' + to + '". Did you define it in one of the rendered templates like this: {{yield "' + to + '"}}?';

          if (console && console.warn)
            console.warn(help);
          else if (console && console.error)
            console.error(help);
          else
            throw new Error(help);
        }
      });
    });

    this.templates.set(to, template);
  },

  setData: function (data) {
    this.data.set(data || {});
  },

  helpers: function () {
    var self = this;
    return {
      'yield': function (key, options) {
        var html;

        if (arguments.length < 2)
          key = null;

        html = self.renderTemplate(key);
        return new Handlebars.SafeString(html);
      }
    };
  },

  renderTemplate: function (key) {
    key = key || '__main__';

    // register that this named yield was used so we can check later that all
    // setTemplate calls were for a yield region that exists.
    this._yields[key] = true;

    // grab the template function from Template or just make the template
    // function return an empty string if no template found
    var template = getTemplateFunction(this.templates.get(key), function () {
      return '';
    });

    var data = this.data.get();
    var helpers = this.helpers();
    var dataContext = _.extend({}, data, helpers);

    return template(dataContext);
  },

  render: function () {
    var self = this;
    return Spark.render(function () {
      return Spark.isolate(function () {
        var layout = getTemplateFunction(self.layout.get());
        var data = self.data.get();
        var helpers = self.helpers();
        var dataContext = _.extend({}, data, helpers);
        return layout(dataContext);
      });
    });
  }
};