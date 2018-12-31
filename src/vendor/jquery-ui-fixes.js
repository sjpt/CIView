function __getElementHeight(el){
	let height= el.css("height");
	if (!height){
		return 0;
	}
	let a= parseInt(height.replace("px",""));
	return a;			
}

$.fn.extend({
  dialogFix: function() {
    return this.each(function() {
	      $(this).parent().find(".ui-dialog-titlebar-close").css("font-size","0px")
	      $(this).on("dialogresize dialogresizestop",function(e,ui){
	    	 $(this).resizeDialog();
	    	
	      });

	    });
    
  },
  resizeDialog:function(){
	  return this.each(function() {
		  let th=$(this);
		  let pa= th.parent();
		  let title_height =__getElementHeight(pa.find(".ui-dialog-titlebar"));
		      let button_height = __getElementHeight(pa.find(".ui-dialog-buttonpane"));
		       let pa_height=__getElementHeight(pa);  
		       let h = (pa_height-title_height-button_height-10)+"px"   	   
	            th.css({width:"auto",height:h});  
	    });
	  	  
  }
});