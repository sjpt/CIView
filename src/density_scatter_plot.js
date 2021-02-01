import {MLVChart,WGLScatterPlot,FilterPanel,MLVColorLegend} from "./graphs.js";
import {dc} from "./vendor/dc.js";
import {d3} from "./vendor/d3.js";
import {WGL2DI} from "./webgl/wgl2di.js";

class DensityScatterPlot extends WGLScatterPlot{
	addItems(state){
		this.type="density_scatter_plot";
		this.def_op=0.05;
	
		this.app.draw_options={
				depth:{enable:false},
			    blend:{enable:true,
				 func: {
                  srcRGB: 'src alpha',
                  srcAlpha: 1,
                 dstRGB: 'one minus src alpha',
                  dstAlpha: 1
              }
		    }
		}
    		let data = this.ndx.getOriginalData();
    	let cl=255;
		let cat = this.config.category;   
    		for (let item of data){
                if (item[cat.field] !== cat.value){
				continue;
			}
    			let x=item[this.x];
    			let y=item[this.y];
    		if (x==null || isNaN(x)|| y==null || isNaN(y)){
    			continue;
    		}
    		cl-=10;
    		this.default_color = [255,0,0];
    		if (this.config.point_type==="square"){
                this.app.addSquare([x,-y],this.config.radius,this.default_color,item.id);
    		}
    		else{
    			this.app.addCircle([x,-y],this.config.radius,this.default_color,item.id,this.def_op);
    		}
			
		}
		
		this.afterInit();
      }

      _calculateRadius(){
      	 return super._calculateRadius()*2;  
      }

      createApp(){
        let c = {
        	brush:this.config.brush,
        	circle_borders:false,
			draw_options:{
				depth:{enable:false},
			    blend:{enable:true,
				 func: {
                  srcRGB: 'src alpha',
                  srcAlpha: 1,
                 dstRGB: 'one minus src alpha',
                  dstAlpha: 1
              }
		    }
			}
		}
         this.app = new WGL2DI(this.graph_id,this.div.width(),this.div.height(),c);
    }
    	
    
			
	
}

MLVChart.chart_types["density_scatter_plot"] ={
		        "class":DensityScatterPlot,
		        name:"Density Scatter Plot",
		        params:[{name:"First Category",type:"text"},{name:"Second Category",type:"text"}],
		       
		    }
