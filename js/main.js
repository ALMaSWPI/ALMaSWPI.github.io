jQuery(function($) {'use strict';

	// Navigation Scroll
		(function($){
		    $.fn.scrollingTo = function( opts ) {
		        var defaults = {
		            animationTime : 1000,
		            easing : '',
		            callbackBeforeTransition : function(){},
		            callbackAfterTransition : function(){}
		        };

		        var config = $.extend( {}, defaults, opts );

		        $(this).click(function(e){
		            var eventVal = e;
		            e.preventDefault();

		            var $section = $(document).find( $(this).data('section') );
		            if ( $section.length < 1 ) {
		                return false;
		            };

		            if ( $('html, body').is(':animated') ) {
		                $('html, body').stop( true, true );
		            };

		            var scrollPos = $section.offset().top;

		            if ( $(window).scrollTop() == scrollPos ) {
		                return false;
		            };

		            config.callbackBeforeTransition(eventVal, $section);

		            $('html, body').animate({
		                'scrollTop' : (scrollPos+'px' )
		            }, config.animationTime, config.easing, function(){
		                config.callbackAfterTransition(eventVal, $section);
		            });
		        });
		    };
		}(jQuery));


	$('.main-menu ul li a,.smooth-scroll').scrollingTo();



	//Slider
	$(document).ready(function() {
		var currentPage = (window.location.pathname.split('/').pop() || 'index.html').toLowerCase();
		var projectPages = [
			'research.html',
			'artu.html',
			'biqu.html',
			'galileo.html',
			'hero.html',
			'perception.html',
			'primo.html'
		];
		var peoplePages = [
			'people.html',
			'mahdi.html'
		];
		var activeHref = currentPage;

		if (projectPages.indexOf(currentPage) !== -1) {
			activeHref = 'research.html';
		} else if (peoplePages.indexOf(currentPage) !== -1) {
			activeHref = 'people.html';
		}

		$('#top-header .navbar-nav li').removeClass('active');
		$('#top-header .navbar-nav a').each(function(){
			var href = ($(this).attr('href') || '').split('#')[0].toLowerCase();
			if (!href && activeHref === 'index.html') {
				href = 'index.html';
			}
			if (href === activeHref) {
				$(this).parent('li').addClass('active');
			}
		});

		function refreshReveals(){
			var revealItems = document.querySelectorAll('.almas-reveal');
			if (!revealItems.length) return;
			document.body.classList.add('reveal-ready');

			if (!('IntersectionObserver' in window)) {
				$(revealItems).addClass('is-visible');
				return;
			}

			if (!window.ALMaSRevealObserver) {
				window.ALMaSRevealObserver = new IntersectionObserver(function(entries){
					entries.forEach(function(entry){
						if (entry.isIntersecting) {
							entry.target.classList.add('is-visible');
							window.ALMaSRevealObserver.unobserve(entry.target);
						}
					});
				}, { threshold: 0.16, rootMargin: '0px 0px -40px 0px' });
			}

			[].forEach.call(revealItems, function(item){
				if (!item.classList.contains('is-visible')) {
					window.ALMaSRevealObserver.observe(item);
				}
			});
		}

		window.ALMaSRefreshReveals = refreshReveals;
		refreshReveals();
		$(window).on('load', refreshReveals);

		var time = 7; // time in seconds

	 	var $progressBar,
	      $bar, 
	      $elem, 
	      isPause, 
	      tick,
	      percentTime;
	 
	    //Init the carousel
	    $("#main-slider").find('.owl-carousel').owlCarousel({
	      slideSpeed : 500,
	      paginationSpeed : 500,
	      singleItem : true,
	      navigation : true,
			navigationText: [
			"<i class='fa fa-angle-left'></i>",
			"<i class='fa fa-angle-right'></i>"
			],
	      afterInit : progressBar,
	      afterMove : moved,
	      startDragging : pauseOnDragging,
	      //autoHeight : true,
	      transitionStyle : "fadeUp"
	    });
	 
	    //Init progressBar where elem is $("#owl-demo")
	    function progressBar(elem){
	      $elem = elem;
	      //build progress bar elements
	      buildProgressBar();
	      //start counting
	      start();
	    }
	 
	    //create div#progressBar and div#bar then append to $(".owl-carousel")
	    function buildProgressBar(){
	      $progressBar = $("<div>",{
	        id:"progressBar"
	      });
	      $bar = $("<div>",{
	        id:"bar"
	      });
	      $progressBar.append($bar).appendTo($elem);
	    }
	 
	    function start() {
	      //reset timer
	      percentTime = 0;
	      isPause = false;
	      //run interval every 0.01 second
	      tick = setInterval(interval, 10);
	    };
	 
	    function interval() {
	      if(isPause === false){
	        percentTime += 1 / time;
	        $bar.css({
	           width: percentTime+"%"
	         });
	        //if percentTime is equal or greater than 100
	        if(percentTime >= 100){
	          //slide to next item 
	          $elem.trigger('owl.next')
	        }
	      }
	    }
	 
	    //pause while dragging 
	    function pauseOnDragging(){
	      isPause = true;
	    }
	 
	    //moved callback
	    function moved(){
	      //clear interval
	      clearTimeout(tick);
	      //start again
	      start();
	    }
	});

	function setPeopleCardAnimations(){
		var page = (window.location.pathname.split('/').pop() || 'index.html').toLowerCase();
		if (page !== 'people.html') return;

		var cards = $('#services .row > [class*="col-"], #services .features > [class*="col-"]');
		if (!cards.length) return;

		cards
			.removeClass('wow fadeInUp animated')
			.addClass('almas-reveal')
			.css({
				visibility: '',
				'animation-name': '',
				'animation-duration': '',
				'animation-delay': ''
			});

		function applyRowDelays(){
			var rows = [];
			cards.each(function(){
				var card = this;
				var top = Math.round(card.getBoundingClientRect().top + window.pageYOffset);
				var row = rows.filter(function(item){
					return Math.abs(item.top - top) < 24;
				})[0];

				if (!row) {
					row = { top: top, cards: [] };
					rows.push(row);
				}
				row.cards.push(card);
			});

			rows.sort(function(a, b){ return a.top - b.top; });
			rows.forEach(function(row, rowIndex){
				row.cards
					.sort(function(a, b){
						return a.getBoundingClientRect().left - b.getBoundingClientRect().left;
					})
					.forEach(function(card, index){
						card.style.transitionDelay = Math.min((index % 4) * 110, 330) + 'ms';
					});
			});
		}

		applyRowDelays();
		$(window).on('load resize', applyRowDelays);
		cards.removeClass('is-visible');
		document.body.classList.add('reveal-ready');
		window.requestAnimationFrame(function(){
			window.requestAnimationFrame(function(){
				if (window.ALMaSRefreshReveals) window.ALMaSRefreshReveals();
			});
		});
	}
	setPeopleCardAnimations();

	//Initiat WOW JS
	new WOW().init();

	// Keep embedded videos visible and usable even when old scroll animations
	// do not fire before the iframe loads.
	function revealVideoEmbeds(){
		$('iframe[src*="youtube.com"]').each(function(){
			$(this)
				.attr('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share')
				.attr('allowfullscreen', 'allowfullscreen')
				.css('visibility', 'visible');
			$(this).closest('.wow')
				.css({ visibility: 'visible', 'animation-name': 'fadeInLeft' })
				.addClass('animated');
		});
	}
	revealVideoEmbeds();
	setTimeout(revealVideoEmbeds, 500);
	$(window).on('load scroll', revealVideoEmbeds);

	//smoothScroll
	smoothScroll.init();

	// portfolio filter
	$(window).load(function(){'use strict';
		var $portfolio_selectors = $('.portfolio-filter >li>a');
		var $portfolio = $('.portfolio-items');
		$portfolio.isotope({
			itemSelector : '.portfolio-item',
			layoutMode : 'fitRows'
		});
		
		$portfolio_selectors.on('click', function(){
			$portfolio_selectors.removeClass('active');
			$(this).addClass('active');
			var selector = $(this).attr('data-filter');
			$portfolio.isotope({ filter: selector });
			return false;
		});
	});



	// Contact form
/*
	var form = $('#main-contact-form');
	form.submit(function(event){
		event.preventDefault();
		var form_status = $('<div class="form_status"></div>');
		$.ajax({
			url: $(this).attr('action'),
			beforeSend: function(){
				form.prepend( form_status.html('<p><i class="fa fa-spinner fa-spin"></i> Email is sending...</p>').fadeIn() );
			}
		}).done(function(data){
			form_status.html('<p class="text-success">Thank you for contact us. As early as possible  we will contact you</p>').delay(3000).fadeOut();
		});
	});
*/

	//Pretty Photo
	$("a[rel^='prettyPhoto']").prettyPhoto({
		social_tools: false
	});



});
