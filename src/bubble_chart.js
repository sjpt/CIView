import {MLVDCChart,MLVChart,findMinMax} from "./graphs.js";
import {dc} from "./vendor/dc.js";
import {d3} from "./vendor/d3.js";


class MLVBubbleChart extends MLVDCChart{
    constructor(ndx,div,config){   
        super(ndx,dc.bubbleChart,div,config);
        this.type="mlv_bubble_chart";
        this.setParameters();
        this.x=config.param[0];
        this.y=config.param[1];
        this.x_range=  findMinMax(this.ndx.getOriginalData(),this.x);
        this.y_range=  findMinMax(this.ndx.getOriginalData(),this.y);
        let yr= this.x_range[1]-this.x_range[0];
        let xr=  this.y_range[1]-this.y_range[0];
        this.cr=30;
	   this.gr= config.param[2];


	   this.setParameters()

        
       this.setSize(null,null,true)
    
    }

    setParameters(params){
    	let self =this;

    	
        
        	this.dim = this.ndx.dimension(function(d) {
            	if (!d[self.gr]){
                	return "none";
            	}
            	return d[self.gr];
        	});
        
        this.group=this.dim.group().reduce(

  			function (p, v) {
				if (v[self.x]==null || v[self.y]==null){
					return p;
				}
      			
      			++p.count;
     				 p.x += v[self.x];
      			p.y += v[self.y];
     				 return p;
  			},

  			function (p, v) {
				if (v[self.x]==null || v[self.y]==null){
					return p;
				}

     				 --p.count;
      			p.x -= v[self.x];
     				 p.y -= v[self.y];
      			return p;
  			},

  		     function () { // reduce-init
  					return {
    						count: 0,
    						x: 0,
    						y: 0
  				};
			}
			);
		    
     
       
       
       this.chart.dimension(this.dim)            
			.group(this.group)
			.transitionDuration(200)
    			.margins({top: 5, right: 5, bottom: 30, left:40})
        		.yAxisPadding(10)
    			.xAxisPadding(10)
    			//.elasticX(true)
    			//.elasticY(true)
  			 .keyAccessor(function (p) {
  			 	if (p.value.count===0){
  			 		return 0;
  			 	}
  				return p.value.x/p.value.count;
			})
			.valueAccessor(function (p) {
				if (p.value.count===0){
  			 		return 0;
  			 	}
 			 	return p.value.y/p.value.count;
			})
			.radiusValueAccessor(function (d) {
				if (d.value.count===0){
  			 		return 0;
  			 	}
  				return d.value.count;
			})

    			.maxBubbleRelativeSize(0.05)
    			//.x(d3.scaleLinear().domain([0, 100]))
    			//.y(d3.scaleLinear().domain([0, 100]))
    			
       
                   
        		//this.chart.render();
      

    }


 
    setSize(x,y,render){
        super.setSize(x,y);
        this.chart
    			.maxBubbleRelativeSize(0.05)
    			.x(d3.scaleLinear().domain([this.x_range[0], this.x_range[1]]))
    			.y(d3.scaleLinear().domain([this.y_range[0], this.y_range[1]]))
    			 .r(d3.scaleLinear().domain([0, this.cr]))
        render?this.chart.render():this.chart.redraw();
    }

}

MLVChart.chart_types["mlv_bubble_chart"] ={
		        "class":MLVBubbleChart,
		        name:"Bubble Chart",
		        params:[{name:"First Category",type:"text"},{name:"Second Category",type:"text"}],
		       
		    }
