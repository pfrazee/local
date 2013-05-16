```javascript
local.env.setRegionPostProcessor(function(updatedEl, containerEl) {
  $("pre[class|=language]", updatedEl).each(function(i, el) {
    Prism.highlightElement(el);
  });
});
```

<br />
#### local.env.setRegionPostProcessor( <small>postProcessorFn</small> ) <small>=> undefined</small>

Sets an environment function to update elements after they've been added to the document.