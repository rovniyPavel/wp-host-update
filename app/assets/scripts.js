(function ($) {
  "use strict";
  
  $(document).ready(function(){
    init_form_tables_switch();
    init_form_findreplace_rows();
    init_form_processing();
  })
  
  /**
   * Safe print helper
   * @param mixed mixed
   */
  function pa(mixed) {
    if ( window.console )
      console.log(mixed);
  }
  
  /**
   * events for radio buttons switcher
   * show/hide custom tables select
   */
  function init_form_tables_switch() {
    $('#replace-form input[name=tables]').on('click', function(){
      var val = $('#replace-form input[name=tables]:checked').val();
      if ( val == 'custom' ) {
        $('#custom-tables').removeClass('hidden');
      } else {
        $('#custom-tables').addClass('hidden');
      }
    });
  }
  
  var rowClone;
  
  /**
   * init events and UI for find/replace input rows:
   * add, delete, sortable
   * 
   * @global row_clone;
   */
  function init_form_findreplace_rows() {
    rowClone = $('#find-replace-rows .row:last').clone();
    
    // add row event
    $('#find-replace-add-row').on('click', function(e){
      e.preventDefault();
      
      $('#find-replace-rows').append( rowClone.clone() );
    });
    
    // delete row event
    $(document).on('click', '#find-replace-rows a.text-danger', function(e){
      e.preventDefault();
      
      // if we have more than one - just remove
      if ( $('#find-replace-rows .row').size() > 1 ) {
        $(this).parents('.row').remove();
      } else {
        // if only one - just clean input values
        $('#find-replace-rows .row input:text').val('');
      }
    });
    
    // init sortable
    $( "#find-replace-rows" ).sortable({
      handle: ".glyphicon-align-justify"
    });
  }
  
  /**
   * form submit button click event
   * runs validation of the form
   */
  function init_form_processing() {
    $('#replace-form button.btn-primary').click(function(e){
      e.preventDefault();
      
      var replace_rows = $('#find-replace-rows .row');
      var search_condition_error = false;
      var confirm_required = false;
      for ( var i = 0; i < replace_rows.size(); i++ ) {
        var row = replace_rows[i];
        $('.form-group', row).removeClass('has-error').addClass('has-success');
        
        var search_empty = ( $.trim($('input:first', row).val()) == '' );
        var replace_empty = ( $.trim($('input:last', row).val()) == '' );
        
        if ( search_empty && !replace_empty ) {
          $('.form-group', row).addClass('has-error').removeClass('has-success');
          search_condition_error = true;
        }
        
        if ( !search_empty && replace_empty ) {
          $('.form-group', row).addClass('has-error').removeClass('has-success');
          confirm_required = true;
        }
      }
      
      if ( search_condition_error && ! alert("You specified wrond search input in some of the rows.\nPlease correct before we can do Magic!") ) {
        return false;
      }
      
      if ( confirm_required && !confirm("You specified empty replace string(s).\nThis can harm you database.\nAre you sure you want to continue?") ) {
        return false;
      }
      
      process_findreplace_form_submit();
    })
  }
  
  var progressBar = {
    spinner: null,
    max: 0,
    current: 0,
    currentStep: 0,
    formData: null
  };
  
  /**
   * form submit ajax and progress bars
   */
  function process_findreplace_form_submit() {
    // collect values
    var replace_rows = $('#find-replace-rows .row');
    var tables_choice = $('#replace-form input[name=tables]:checked').val();
      // autoselect options if "all" selected
      if ( tables_choice == 'all' ) {
        $('#custom-tables select option').attr('selected', true);
      }
    var tables_custom = $('#custom-tables select').val();

    var search_replace = [];
    for ( var i=0; i < replace_rows.size(); i++ ) {
      var row = replace_rows[i];
      var search = $.trim($('input:first', row).val());
      var replace = $.trim($('input:last', row).val());

      search_replace.push( [search, replace] );
    }

    progressBar.formData = {
      search_replace: search_replace,
      tables_choice: tables_choice,
      tables_custom: tables_custom
    };

    pa(progressBar.formData);

    ajax_request('page/run', {
      data: progressBar.formData,
      success: function(resp) {
        // validate response
        if ( typeof(resp) != 'object' ) {
          alert('Bad server response');
          return;
        }
        if ( resp.error ) {
          alert(resp.error);
          return;
        }

        $('#replace-form').replaceWith( resp.progress_html );
        progressBar.max = resp.progress_max;
        
        process_progressbar();
      }
    });
  }
  
  var spinnerOpts = {
      lines: 7 // The number of lines to draw
    , length: 6 // The length of each line
    , width: 2 // The line thickness
    , radius: 2 // The radius of the inner circle
    , scale: 1 // Scales overall size of the spinner
    , corners: 1 // Corner roundness (0..1)
    , color: '#000' // #rgb or #rrggbb or array of colors
    , opacity: 0.25 // Opacity of the lines
    , rotate: 0 // The rotation offset
    , direction: 1 // 1: clockwise, -1: counterclockwise
    , speed: 1 // Rounds per second
    , trail: 60 // Afterglow percentage
    , fps: 20 // Frames per second when using setTimeout() as a fallback for CSS
    , zIndex: 2e9 // The z-index (defaults to 2000000000)
    , className: 'spinner' // The CSS class to assign to the spinner
    , top: '9px' // Top position relative to parent
    , left: '77%' // Left position relative to parent
    , position: 'absolute' // Element positioning    
    };
    
  /**
   * run ajax for each table in request, update progress bar
   */
  function process_progressbar() {
    var step = progressBar.currentStep;
    var wp_table = progressBar.formData.tables_custom[step];
    
    $('#progress-log').append( '<div class="row"><div class="col-md-1 text-right indicator"></div><div class="col-md-11 text"></div></div>' );
    
    progressBar.spinner = new Spinner(spinnerOpts).spin();
    pa(progressBar.spinner);
    
    var log = $('#progress-log .row:last');
    log.find('.text').html('Processing table <span class="text-warning">' + wp_table + '</span>...');
    log.find('.col-md-1').append(progressBar.spinner.el);
    
    var data = progressBar.formData;
    data.step = progressBar.currentStep;
    ajax_request( 'page/processTable', {
      data:data,
      success: function(resp) {
        var valeur = 20;
        $('.progress-bar').css('width', valeur+'%').attr('aria-valuenow', valeur);    
        pa('ALL GOOD');
      }
    })
  }
  
  /**
   * call ajax request
   * 
   * @param string action  controller/action string
   * @param object params  ajax params
   */
  function ajax_request(action, params) {
    var basePath = window.location.pathname;
    params.url = basePath + '?r=' + action;
    
    if ( ! params.type ) params.type = 'POST';
    
    pa(params);
    
    $.ajax(params);
  }
  
}(jQuery));