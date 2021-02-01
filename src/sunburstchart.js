import {MLVDCChart,MLVChart,findMinMax} from "./graphs.js";
import {dc} from "./vendor/dc.js";
import {d3} from "./vendor/d3.js";


class MLVSunBurst extends MLVDCChart{
    constructor(ndx,div,config){   
        super(ndx,dc.sunburstChart,div,config);
        this.type="mlv_bubble_vhart";
        this.setParameters();
	this.type="mlv_sunburst_chart";
       
        
       this.setSize(null,null,true)
    
    }

    setParameters(params){
    	let self =this;

    	
        
        	this.dim = this.ndx.dimension(function(d) {
            		return [d[self.config.param[0]],d[self.config.param[1]]];
        	});
        	this.group =  this.dim.group();
     
		    
     
      
       this.chart.dimension(this.dim)            
			.group(this.group)
			
        		
    			
    			
       
                   
        		
      

    }


 
    setSize(x,y,render){
        super.setSize(x,y);
     //this.chart.width(1000).height(1000);
       
        this.chart.radius(this.height<this.width?(this.height-20)/2:this.width/2);
        this.chart.render();
        //render?this.chart.render():this.chart.redraw();
    }

}

MLVChart.chart_types["mlv_sunburst_chart"] ={
		        "class":MLVSunBurst,
		        name:"SunBurst Chart",
		        params:[{name:"First Category",type:"text"},{name:"Second Category",type:"text"}],
		       
		    }
