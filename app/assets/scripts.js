(function (jQuery) {
  "use strict";
  
  jQuery(document).ready(function(){
    init_form_tables_switch();
    init_form_findreplace_rows();
    init_form_processing();
  });

  /**
   * Safe print helper
   * @param mixed mixed
   */
  function pa(mixed) {
    if ( window.console )
      console.info(mixed);
  }
  
  /**
   * events for radio buttons switcher
   * show/hide custom tables select
   */
  function init_form_tables_switch() {
    jQuery('#replace-form input[name=tables]').on('click', function(){
      var val = jQuery('#replace-form input[name=tables]:checked').val();
      if ( val == 'custom' ) {
        jQuery('#custom-tables').removeClass('hidden');
      } else {
        jQuery('#custom-tables').addClass('hidden');
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
    rowClone = jQuery('#find-replace-rows .row:last').clone();

    // add row event
    jQuery('#find-replace-add-row').on('click', function(e){
      e.preventDefault();
      
      jQuery('#find-replace-rows').append( rowClone.clone() );
    });
    
    // delete row event
    jQuery(document).on('click', '#find-replace-rows a.text-danger', function(e){
      e.preventDefault();
      
      // if we have more than one - just remove
      if ( jQuery('#find-replace-rows .row').size() > 1 ) {
        jQuery(this).parents('.row').remove();
      } else {
        // if only one - just clean input values
        jQuery('#find-replace-rows .row input:text').val('');
      }
    });
    
    // init sortable
    jQuery( "#find-replace-rows" ).sortable({
      handle: ".glyphicon-align-justify"
    });
    
    // init disable of domains check
    jQuery('#find-multisite-rows a.text-danger').click(function(e){
      e.preventDefault();
      
      var row = jQuery(this).parents('div.row');
      if ( !this.is_disabled ) this.is_disabled = true;
      else this.is_disabled = false;
      jQuery('input', row).attr('disabled', this.is_disabled);
    });
  }
  
  /**
   * form submit button click event
   * runs validation of the form
   */
  function init_form_processing() {
    jQuery('#replace-form button.btn-primary').click(function(e){
      e.preventDefault();
      
      var replace_rows = jQuery('#find-replace-rows .row');
      var search_condition_error = false;
      var confirm_required = false;
      for ( var i = 0; i < replace_rows.size(); i++ ) {
        var row = replace_rows[i];
        jQuery('.form-group', row).removeClass('has-error').addClass('has-success');
        
        var search_empty = ( jQuery.trim(jQuery('input:first', row).val()) == '' );
        var replace_empty = ( jQuery.trim(jQuery('input:last', row).val()) == '' );
        
        if ( search_empty && !replace_empty ) {
          jQuery('.form-group', row).addClass('has-error').removeClass('has-success');
          search_condition_error = true;
        }
        
        if ( !search_empty && replace_empty ) {
          jQuery('.form-group', row).addClass('has-error').removeClass('has-success');
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
    value: 0,
    currentStep: 0,
    formData: null,
    timer: 0
  };
  
  /**
   * form submit ajax and progress bars
   */
  function process_findreplace_form_submit() {
    // collect values
    var replace_rows = jQuery('#find-replace-rows .row');
    var domain_rows = jQuery('#find-multisite-rows .row');
    var tables_choice = jQuery('#replace-form input[name=tables]:checked').val();
      // autoselect options if "all" selected
      if ( tables_choice == 'all' ) {
        jQuery('#custom-tables select option').attr('selected', true);
      }
    var tables_custom = jQuery('#custom-tables select').val();
    var replace_method = jQuery('#replace-form input[name=replace_method]:checked').val();

    var search_replace = [];
    for ( var i=0; i < replace_rows.size(); i++ ) {
      var row = replace_rows[i];
      var search = jQuery.trim(jQuery('input:first', row).val());
      var replace = jQuery.trim(jQuery('input:last', row).val());

      search_replace.push( [search, replace] );
    }
    var domain_replace = [];
    for ( i=0; i < domain_rows.size(); i++ ) {
      row = domain_rows[i];
      search = jQuery.trim(jQuery('input:first', row).val());
      replace = jQuery.trim(jQuery('input:last', row).val());

      domain_replace.push( [search, replace] );
    }

    progressBar.formData = {
      search_replace: search_replace,
      domain_replace: domain_replace,
      tables_choice: tables_choice,
      tables_custom: tables_custom,
      replace_method: replace_method
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

        jQuery('.jumbotron').remove();
        jQuery('#replace-form').replaceWith( resp.progress_html );
        progressBar.max = resp.progress_max;
        
        process_tables_one_by_one();
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
  
  var progress_scroll = 0;
  /**
   * run ajax for each table in request, update progress bar
   */
  function process_tables_one_by_one() {
    var log, wp_table;
    var step = progressBar.currentStep;
    var lastStep = progressBar.formData.tables_custom.length;
    
    // update previous log row if not first step
    if ( step > 0 ) {
      progressBar.spinner.stop();
      
      log = jQuery('#progress-log .row:last');
      wp_table = progressBar.formData.tables_custom[step-1];
      log.find('.text').html('Completed with table <span class="text-warning">' + wp_table + '</span>.');
      log.find('.col-md-1').html('<span class="text-success glyphicon glyphicon-ok"></span>');
    }

    if ( step == lastStep ) {
      pa('Run in: ' + progressBar.timer + ' sec');
      process_completed_page();
      return;
    }
    
    // insert new log row
    wp_table = progressBar.formData.tables_custom[step];
    progressBar.spinner = new Spinner(spinnerOpts).spin();

    jQuery('#progress-log').append( '<div class="row"><div class="col-md-1 text-right indicator"></div><div class="col-md-11 text"></div></div>' );
    
    log = jQuery('#progress-log .row:last');
    log.find('.text').html('Processing table <span class="text-warning">' + wp_table + '</span>...');
    log.find('.col-md-1').append(progressBar.spinner.el);
    progress_scroll += 20;
    jQuery('#progress-log').animate({scrollTop:progress_scroll}, 'fast');

    var data = progressBar.formData;
    data.step = progressBar.currentStep;
    ajax_request( 'process/index', {
      data:data,
      success: function(resp) {
        if (typeof resp == 'object') {
          pa({'table': resp.table, 'rows': resp.found + ' > ' + resp.updated, 'in': resp.in + 's'})

          progressBar.value += resp.found * 1;
          progressBar.timer += resp.in;
          update_progress_bar();
        }
        else {
          pa(resp);
          alert('Update failed for table "' + progressBar.formData.tables_custom[progressBar.currentStep] + '"');
        }

        progressBar.currentStep++;
        process_tables_one_by_one();
      }
    })
  }
  
  function update_progress_bar() {
    var percents = Math.round( progressBar.value * 100 / progressBar.max );
    jQuery('.progress-bar').css('width', percents+'%').attr('aria-valuenow', percents);    
  }
  
  function process_completed_page() {
    ajax_request('page/thanks', {
      success: function(resp) {
        jQuery('#running').replaceWith(resp);
      }
    })
  }
  
  /**
   * call ajax request
   * 
   * @param action string    controller/action string
   * @param params object    ajax params
   */
  function ajax_request(action, params) {
    var basePath = window.location.pathname;
    params.url = basePath + '?r=' + action;
    
    if ( ! params.type ) params.type = 'POST';
    
    //pa(params);
    
    jQuery.ajax(params);
  }
  
}(jQuery));