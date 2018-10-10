import {d3} from "./vendor/d3.js";
import {dc} from "./vendor/dc.js";
import {crossfilter} from "./vendor/crossfilter.js";
import {WGL2DI} from "./webgl/wgl2di.js";


$('html > head').append( $('<style>.div-bar_chart svg {padding-left:5px; }</style>'));

class FilterPanel{
    constructor(div_id,data,listener){
        let self=this;
        this.div=$("#"+div_id);
        this.extra_divs={};
        this.ndx= crossfilter(data);
        this.filtered_ids;
        this.filter_sets={};
        this.filter_sets_length=0;
        this.charts={};
        this.listener=listener;
        this.total_height_weight=0;
        this.set_margin=30;
        this.param_to_graph={};
        $(window).on("resize",function(e){     
            self.resize();
        });

    }
    
    resize(){
        let n = this.filter_sets_length;
        let t_height= (this.div.height()-(n*this.set_margin))
        for (let name in this.filter_sets){
          
            let fs= this.filter_sets[name];
            let width = fs.div.width()/fs.charts.length;
            if (width>fs.dimensions[0][0]){
                width=fs.dimensions[0][0];
            }
            else if (width<fs.dimensions[0][1]){
                width=fs.dimensions[0][0];
            }
          
            let height = t_height * (fs.height_weight/this.total_height_weight);
            if (this.extra_divs[name]){
                height = fs.div.parent().height()-this.set_margin;
            }
            if (height>fs.dimensions[1][0]){
                height=fs.dimensions[1][0];
            }
            else if (height<fs.dimensions[1][1]){
                height=fs.dimensions[1][1];
            }

            for (let chart of fs.charts){
                    chart.setSize(width,height);
            }
        }
        dc.redrawAll();
        

    }

    dataChanged(field,not_broadcast){
        let chart = this.param_to_graph[field];
        if (chart){
            chart.dataChanged(not_broadcast);
            chart.chart.redraw()
        }
    }

    addFilterSet(name,height_weight,custom_div){
        let div =$("<div style='display:flex'></div>")
        if (!custom_div){
            div.appendTo(this.div);
            this.filter_sets_length++;
        }
        else{
            div.appendTo(custom_div);
            this.extra_divs[name]=custom_div;
        }
         
        this.filter_sets[name]={div:div,dimensions:[[2000,80],[2000,80]],charts:[]};
       
        if (!height_weight){
            height_weight=1;
        }
        if (!custom_div){
            this.filter_sets[name].height_weight=height_weight;
            this.total_height_weight+=height_weight;
        }
         
          
    }

    removeFilterSet(name){
        let fs = this.filter_sets[name];
        if (!fs){
            return false;
        }
        let left = null
        for (let chart of fs.charts){
            left =chart.remove()
        }
        if (!this.extra_divs[name]){
            this.filter_sets_length--;
            this.total_height_weight-=fs.height_weight;

        }
        else{
            delete this.extra_divs[name];
        }

        fs.div.remove();
        delete this.filter_sets[name];
        this._chartFiltered(left);
        this.resize();
    }

    addChart(set,type,params,label,size,cap){
        let self = this;
        
        
        let id = "filter-chart-"+FilterPanel.count++;
        let div=$("<div>").attr("id",id);
        div.appendTo(this.filter_sets[set].div);
        let chart = new FilterPanel.chart_types[type](this.ndx,params,id,label,size,cap);
        this.charts[label]=chart;
        this.filter_sets[set].charts.push(chart);
        chart.setUpdateListener(function(filtered_items,name){
            self._chartFiltered(filtered_items,name);
        });
        if  (typeof(params) !=="string"){
            for (let param of params){
                this.param_to_graph[param]=chart;
            }
        }
        else{
            this.param_to_graph[params]=chart;
        }

    }

    _chartFiltered(filtered_items,chart_exclude){
        this.filtered_ids={};
        for (let item of filtered_items){
            this.filtered_ids[item.id]=true
        }
        for (let name in this.charts){
            let chart = this.charts[name];
            if (chart._hide){
                if (name == chart_exclude){
                    chart._filter(this.filtered_ids);

                }
                else{
                    chart._hide(this.filtered_ids);
                }
            }
         }
         this.listener(filtered_items,this.filtered_ids);
    }

    setListener(func){
        this.listener=func;
    }

    refresh(){
       
        dc.renderAll();
        this.resize();
    }
}




class MLVChart{
    constructor(ndx,div_id,chart_type,title){
        let self=this;
        this.ndx=ndx;
        this.div=$("#"+div_id).css({"display":"inline-block"});
        let ti=$("<span>").text(title).appendTo(this.div).css({"display":"flex","white-space":"nowrap"});
        this.chart=chart_type("#"+div_id);
        this.chart.on("filtered",function(){
            if (self.not_broadcast){
                self.not_broadcast=false;
            }
            else{
                self.updateListener(self.dim.top(100000));
            }
         });

        this.title=title;

        this.chart.controlsUseVisibility(true);
        
      
         
        //let inner_div=$("<div>");
        //inner_div.append("<span style='font-weight:bold'>"+this.title+"</span>");
        //inner_div.appendTo(this.div);
        let reset_but = $("<button>").text("reset").attr("class","pull-right reset btn btn-sm btn-primary").css({height:"20px","padding":"2px","margin-left":"5px","visibility":"hidden"})
            .click(function(e){
            self.chart.filterAll();
            dc.redrawAll();
            })
            .appendTo(ti);

        this.updateListener=function(){};

    }

    setUpdateListener(func){
        this.updateListener=func;
    }

    setSize(x,y){
        this.chart.width(x).height(y);
        this.width=x;
        this.height=y;
       
    }

    remove(){
       
        this.dim.filter(null);
        let left = this.dim.top(1000000);
        this.dim.dispose();
        this.chart.resetSvg();
        this.div.remove();
        return left;
    }

    dataChanged(){

    }

}





class MLVBarChart extends MLVChart{
    constructor(ndx,param,div_id,title,size){
       
          
        
        super(ndx,div_id,dc.barChart,title);
        let self =this;
        this.div.addClass("class","div-bar_chart");
          
        this.default_bin_number=10;
        this.param=param;
       
        //work out 
        this.dim = ndx.dimension(
            function(d){return d[self.param];}
        );
        this.max = this.dim.top(1)[0][param];
        this.min= this.dim.bottom(1)[0][param];
        if (!size){
            size=[300,200];
        }
        this.setSize(size[0],size[1]);
     

        this.setParameters({max:this.max,min:this.min,bin_number:this.default_bin_number});
    }

    setSize(x,y){
         this.chart.x(d3.scaleLinear().domain([this.display_min-this.bin_width,this.display_max+this.bin_width]));
         super.setSize(x,y);
    }

   

    setParameters(params){
        let self=this;
        if (!params){
          this.display_max=this.max;
          this.display_min=this.min;
          this.bin_number=this.default_bin_number;  

        }
        else{
            if (params.max || params.max===0){
                this.display_max=params.max;
            }
            if (params.min || params.min===0){
            this.display_min=params.min;
            }
            if (params.bin_number){
                this.bin_number=params.bin_number;
            }
        }
        this.dim.dispose();
        this.range = this.display_max-this.display_min

        this.bin_width=this.range/this.bin_number
        this.dim=this.ndx.dimension(
            function(d){
                if (d[self.param]>self.display_max){
                    return self.display_max
                }
                if (d[self.param]<self.display_min){
                    return self.display_min
                }

                return d[self.param];
           }
        );
        if (this.group){
            this.group.dispose()
        }
        this.group = this.dim.group(function(d){
             return self.bin_width * Math.floor(d/self.bin_width);
        });
        this.chart.dimension(this.dim)
                   .xUnits(dc.units.fp.precision(this.bin_width))
                   .group(this.group)
                   .x(d3.scaleLinear().domain([this.display_min-this.bin_width,this.display_max+this.bin_width]))
                   .elasticY(true);
        this.chart.render();
                        
    }
}


class WGLScatterPlot{
    constructor(ndx,params,div_id,title,size){
        this.name=title;
        if (!size){
            size=[200,200];
        }
        this.x= params[0];
        this.y=params[1];
        let self = this
        this.dim = ndx.dimension(function (d) {
            return [d[self.x], d[self.y]];
        }),
        this.group=this.dim.group();
        
        let y_dim = ndx.dimension(function(d){return d[self.y]});
        this.max_y=y_dim.top(1)[0][self.y];
        this.min_y=y_dim.bottom(1)[0][self.y];
        y_dim.dispose();
        let x_dim = ndx.dimension(function(d){return d[self.x]});
        this.max_x= x_dim.top(1)[0][self.x];
        this.min_x= x_dim.bottom(1)[0][self.x];
        x_dim.dispose();
        let x_margin=Math.round((this.max_x-this.min_x)/10);
        let y_margin=Math.round((this.max_y-this.min_y)/10);

        let x_range = this.max_x-this.min_x;
        this.x_scale=1000/x_range;
        this.x_scale = this.x_scale>1?1:this.x_scale;

        let y_range = this.max_y-this.min_y;
        this.y_scale=1000/y_range;
        this.y_scale = this.y_scale>1?1:this.y_scale;

        let div = $("#"+div_id);
        this.div=div;
        let title_div=$("<div>").css({"display":"flex","white-space":"no-wrap"}).text(title);
        this.reset_but = $("<button>").attr("class","pull-right btn btn-sm btn-primary")
             .text("reset").css({height:"20px","padding":"2px","margin-left":"5px","visibility":"hidden"})
             .click(function(e){
                 self.app.clearBrush();
                 self._createFilter(null);
                 self.reset_but.css("visibility","hidden");
             }).appendTo(title_div);
        title_div.appendTo(div);
        let id = "wg-graph-"+WGLScatterPlot.count++;
        let graph_div= $("<div>").css("position","relative").attr("id",id).appendTo(div)
        $("#"+div_id).css("position","relative");



        this.radius = y_range/50;
        this.app = new WGL2DI(id,200,200);
        let data = this.dim.top(10000000);
        for (let item of data){
			this.app.addCircle([item[params[0]],-(item[params[1]])],this.radius,[123,45,67],item.id);
		}


		
		
		this.app.initialise();
		this.app.addHandler("brush_stopped",function(range){
		    self.reset_but.css("visibility","visible");
		    range.y_max=-range.y_max;
		    range.y_min=-range.y_min;
		    self._createFilter(range);
		})
    }
    setUpdateListener(func){
        this.updateListener=func;
    }


    remove(){
        this.dim.filter(null);
        let left  = this.dim.top(1000000);
        this.dim.dispose();
        this.div.remove();
        return left;
    }
    
    _createFilter(range){
        if (range==null){
            this.dim.filter(null);
        }
        else{
         
            this.dim.filter(function(d){
                if (d[0]>range.x_max || d[0]<range.x_min){
                    return false;
                }
                if (d[1]<range.y_max || d[1]>range.y_min){
                    return false;
                }
                return true;
            });
        }
        dc.redrawAll();
        let name = this.name;
        if (range==null){
            name=null;
        }
        this.updateListener(this.dim.top(1000000),name);
    }

    setSize(x,y){
        this.app.setSize(x,y);
        
      
        let x_margin=Math.round((this.max_x-this.min_x)/10);
        let y_margin=Math.round((this.max_y-this.min_y)/10);
        let x_range = (this.max_x-this.min_x)+2*x_margin;
        let y_range= (this.max_y-this.min_y)+2*y_margin;

        let x_scale= x/x_range;
        let y_scale= y/y_range

        this.app.x_scale = x/x_range;
        this.app.y_scale = y/y_range;
        this.app.offset[0]=-(this.min_x-x_margin);
        this.app.offset[1]=(this.max_y+y_margin);
       this.app.refresh();
        
    }
    _hide(ids){ 
        this.app.hideObjects(ids);
        this.app.refresh();
    }

    _filter(ids){
        this.app.filterObjects(ids);
        this.app.refresh()
    }

}
WGLScatterPlot.count=0;


class MLVScatterPlot extends MLVChart{
    constructor(ndx,params,div_id,title,width,size){
    
        super(ndx,div_id,dc.scatterPlot,title);
        this.x= params[0];
        this.y=params[1];
        let self = this
        this.dim = ndx.dimension(function (d) {
            return [d[self.x], d[self.y]];
        }),
        this.group=this.dim.group();
        
        let y_dim = ndx.dimension(function(d){return d[self.y]});
        this.max_y=y_dim.top(1)[0][self.y];
        this.min_y=y_dim.bottom(1)[0][self.y];
        y_dim.dispose();
        let x_dim = ndx.dimension(function(d){return d[self.x]});
        this.max_x= x_dim.top(1)[0][self.x];
        this.min_x= x_dim.bottom(1)[0][self.x];
        x_dim.dispose();
        let x_margin=Math.round((this.max_x-this.min_x)/10);
        let y_margin=Math.round((this.max_y-this.min_y)/10)

        this.chart
            .x(d3.scaleLinear().domain([this.min_x-x_margin,this.max_x+x_margin]))
            .y(d3.scaleLinear().domain([this.min_y-y_margin,this.max_y+y_margin]))
            .yAxisLabel("y")    
            .xAxisLabel("x")
            .clipPadding(10)
            .dimension(this.dim)
            .excludedOpacity(0.5)
            .group(this.group).
            colorAccessor(function (d){
                return "red";
            });

        if (!size){
            size=[300,300];
        }
        this.setSize(size[0],size[1]);   
    }

    setSize(x,y){
        let x_margin=Math.round((this.max_x-this.min_x)/10);
        let y_margin=Math.round((this.max_y-this.min_y)/10)

        this.chart
            .x(d3.scaleLinear().domain([this.min_x-x_margin,this.max_x+x_margin]))
            .y(d3.scaleLinear().domain([this.min_y-y_margin,this.max_y+y_margin]));
        super.setSize(x,y);
    }
}



class MLVRowChart extends MLVChart{
    constructor(ndx,param,div_id,title,size,cap){
     
        super(ndx,div_id,dc.rowChart,title);
        let self =this;
        this.param=param;
    
        this.dim = ndx.dimension(function(d) {
            if (!d[self.param]){
                return "none"
            }
            return d[self.param];
        });
        this.group=this.dim.group().reduceCount();
        if (!size){
           size=[100,100];
        }
        this.setSize(size[0],size[1]);
        this.chart
            .dimension(this.dim)
            .group(this.group)
             .elasticX(true);

        if (cap){
            this.chart.cap(5);
        }
        this.chart.render();
  
         

    }

    dataChanged(not_broadcast){
        let self = this;
        this.not_broadcast=not_broadcast;

        let filter= this.chart.filters();
          if (filter.length>0){
           this.chart.filter(null);
        }

        this.dim.dispose();
  
    
        this.dim = this.ndx.dimension(function(d) {
            if (!d[self.param]){
                return "none"
            }
            return d[self.param];
        });
        this.group=this.dim.group().reduceCount();
        this.chart
            .dimension(this.dim)
            .group(this.group)
      
        if (filter.length>0){
             this.not_broadcast=not_broadcast
           
            this.chart.filter(filter);
        }

      
    }

    setSize(x,y){
        super.setSize(x,y);
        //this.resetDimension()
    }


}

class MLVRingChart extends MLVChart{
    constructor(ndx,param,div_id,title,size){
        super(ndx,div_id,dc.pieChart,title);
    
        let self = this;
        this.param=param;
        this.dim = ndx.dimension(function(d) {return d[self.param];});
        this.group=this.dim.group().reduceCount();
       


        if (!size){
           size=[100,100];
        }
        this.setSize(size[0],size[1]);
        this.chart
            .dimension(this.dim)
            .group(this.group)
            .innerRadius(0.1*this.height);


    }

    setSize(x,y){
       if (x>y){
            x=y;
        }
        else if (y>x){
            y=x;
        }
        super.setSize(x,y);
       
    }
}

FilterPanel.chart_types={
    "scatter_plot":MLVScatterPlot,
    "bar_chart":MLVBarChart,
    "ring_chart":MLVRingChart,
    "row_chart":MLVRowChart,
    "wgl_scatter_plot":WGLScatterPlot
}

FilterPanel.count=0;


export {MLVRingChart,MLVScatterPlot,MLVBarChart,MLVChart,FilterPanel};


