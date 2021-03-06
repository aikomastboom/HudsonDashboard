var Jenkins = function( project, selector ) {
	
	if ( typeof project == 'undefined' ) return 'Please provide a project name';
	selector = selector || 'body';
	
	// Main model
	var status = {};
	status.project = project;

	// URLs of services
	var url = {};
	//url.base = 'https://hudson.informaat.nl/job/';
	url.base = 'http://hudson.local:8080/job/';
	url.build = 'IPE-release/lastBuild/api/json';
	
	switch(project) {
	case 'server':
		url.coverage = 'IPE-release/ws/coverage-report/coverage.html';
		break;
	case 'client':
		url.coverage = 'IPE-release/ws/client/client.json';
		break;
	}
	
	var $placeholder = $({});
	
	var timer; // timer interval id

	
	// server:
	// lastBuild: https://hudson.informaat.nl/job/IPE-release/lastBuild/api/json
	// coverage: https://hudson.informaat.nl/job/IPE-release/coverage_report/coverage.html
	
	// client:
	// lastBuild: https://hudson.informaat.nl/job/IPE-release/lastBuild/api/json
	// coverage: https://hudson.informaat.nl/job/IPE-release/client/client.json
	
	var model = {
		getLastBuild: function() {
			return jQuery.getJSON( url.base + url.build +'?jquery&jsonp=?' );
		}
		
		, getCoverage: function() {
			var result = $.ajax(url.base + url.coverage);
			return result;
		}
		
		, scrapeCoveragePercentage: function(report) {
			var $report = $(report);
			console.log($report.length);
			var percentage = ($report.length > 0) ? $report.find('#stats:first .percentage').text() : 'No coverage!';
			return model.inspectCoverage(percentage);
		}
		
		, inspectCoverage: function(percentage) {
			// Take a look at percentage, wrap it in classes depending on its value
			var wrapped;
			var value;
			
			// take off the %
			value = percentage.slice(0,-1); 
			                                 
			if(value <= 70) return wrapped = '<span class="low">'+value+'%</span>';
			if(value <= 89) return wrapped = '<span class="medium">'+value+'%</span>';
			if(value >= 90) return wrapped = '<span class="ok">'+value+'%</span>';
		}
		
		, getCoverageReport: function(report) {
			var $report = $(report).find('#stats');
			var stats = ($report.length > 0 || ! $report) ? $report.html() : 'No coverage!';
			
			return stats;
		}
		
		, createCoverageIframe: function( callback ) {
			// TODO: this is now deprecated: see `model.getCoverage`
			// Implemented as a `$.Deferred`
			var def = $.Deferred();
			var $iframe = $('<iframe id="coverage-' + status.project + '" src="' + url.base + url.coverage + '" style="display: none;"></iframe>');
			$iframe.appendTo('body');
			// $iframe.load( callback( $iframe.contents() ));
			$iframe.load( function() {
				def.resolve($(this));
			} );
			return def.promise();
		}
		
		, parseBuild: function(build) {
			var stat = {};
			stat.person		= build.culprits[0].fullName.split(' ')[0] || 'Anonymous';
			stat.status		= build.result || 'No status message';
			stat.message	= (build.changeSet.items.length) ? build.changeSet.items[0].msg : 'No message';
			stat.time		= new Date( build.timestamp ).toLocaleString();
			
			return stat;
		}
		
		// Trim leading and trailing spaces from `s`
		, trim: function( s ) {
				s = s.replace(/(^\s*)|(\s*$)/gi,"");
				s = s.replace(/[ ]{2,}/gi," ");
				s = s.replace(/\n /,"\n");
				return s;
		}
		
		, fetch: function( callback ) {
			// Execute the 2 loads in parallel as deferreds:
			jQuery
			.when( model.getLastBuild(), model.getCoverage() )
			// .when( model.getLastBuild(), model.createCoverageIframe() )
			.fail( function() { console.log('error', arguments); })
			.done(function(build, coverage) {
				// TODO: check for errors, handle them
				var tmp = model.parseBuild(build[0]);
				
				// console.log('build', build[0]);
				
 				status.person = tmp.person;
				status.status = tmp.status;
				status.message = tmp.message;
				status.time = tmp.time;
				
				status.coverage = model.scrapeCoveragePercentage(coverage[0]);
				// status.coverage = model.getCoverageReport(coverage[0]);
				
				callback( status );
			});
		}
	};
	
	var view = {
		template: function(data) {
			return '<article id="' + data.project + '" class="' + data.status + '">'
			+ '<h2 class="animate">' + data.project + '</h2>'
			+ '<dl>'             
			+ '<dt class="animate coverage">Coverage</dt>'
			+ '<dd class="animate coverage">' + data.coverage + '</dd>'
			+ '<dt class="animate person">Push</dt>'
			+ '<dd class="animate person">' + data.person + '</dd>'
			+ '<dt class="animate message">Message</dt>'
			+ '<dd class="animate message info">' + data.message + '<br />' + data.time + '</dd>'
			+ '</dl>'
			+ '</article>';
		}
		
		, render: function(data) {
			var item = view.template( data );
			var $view = $('#' + data.project);
			
			// TODO: does this return either $view or $(body)?
			($view.length) ? $view.replaceWith( item ) : $(selector).append( item );
			
			// Flip item into view
			// view.flip();
			
			controller.checkForBrokenBuild();
		}
		
		, pulse: function($element) {
			$element.animate({opacity: 0.2}, 500).animate({opacity: 1}, 500, function() { view.pulse($element); });
		}
		
		, flip: function() {
			$('.animate')
				.addClass('animation')
				.animate({position: 'static'}, 0, function() { $(this).addClass('up'); })
				.delay(8500)
				.animate({position: 'static'}, 0, function() { $(this).removeClass('up').addClass('flip');});
		}
	};
	
	var controller = {
		poll: function( interval ) {
			interval = interval || 10 * 1000;
			
			// If a timer was previously set, clear it:
			if(timer) controller.stop( timer );
			
			// TODO: the timer will just increment infinitely. At some the int will be to large; reload the page when the timer > 8640 (this is once every 24h)
			
			// Set a new timer:
			timer = setTimeout( controller.init, interval );
			return timer;
		}
		
		, stop: function( timer ) {
			clearTimeout( timer );
			return 'stopped polling';
		}
		
		, init: function() {
			model.fetch(view.render);
			controller.poll();
			
			// TODO: add a check for failure, call view.pulse() on it
		}
		
		, getCoverage: function() {
			model.createCoverageIframe(model.scrapeCoveragePercentage);
		}
		
		, play: function() {
			var alert = document.getElementById('alert');
			alert.play();
		}
		
		, checkForBrokenBuild: function() {
			// Find broken builds and low coverage, play an alert, pulse them
			var $broken = $(selector).find('.FAILURE, .low');
			if($broken.length) {
				controller.play();
				view.pulse($broken);
			};
		}
	};

	var api = {
		  init: controller.init
		, poll: controller.poll
		, stop: controller.stop
		, play: controller.play
	};
	
	return api;
};
