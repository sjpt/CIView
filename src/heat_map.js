import {FilterPanel,MLVChart,WGLChart,groupAndOrder,MLVChartDialog} from "./graphs.js";
import {d3} from "./vendor/d3.js";
import {WGL2DI} from "./webgl/wgl2di.js";
import {HierarchicalClustering} from "./clustering/cluster.js";

class WGLSummaryHeatMap extends WGLChart{
    constructor(ndx,div,config){
    		super(ndx,div,config);
				let self = this;
				this.type= "summary_heat_map";
			
				
				let params = this.config.param;
				let cat = config.y_axis_category;
				this.groups = groupAndOrder(this.ndx.getOriginalData(),cat);
				this.matrix={};
				this.group_to_count={};
				let row=0;
				this.addAxis({
					y_scale:"band",
					x_scale:"band",
					y_axis_width:50,
					x_axis_height:50
				});
				this.app = new WGL2DI(this.graph_id,50,50);
				this.getAverages();	
				let y_groups=[];
				for (let g of this.groups){
					let column=0;
					let par = this.matrix[g.value];
					for (let f of this.config.param){
						 let color = this.convertToRGB(this.color_scale(par[f]));
						 let id = g.value+"|"+f;
						 this.app.addRectangle([column,row],10,10,color,id);
						 column+=10;
						
					}
                    y_groups.push(g.value);
					row+=10;  	            	     
				}
				let x_groups=[];
				for (let f of params){
					x_groups.push(this.config.param_labels[f]);
				}
	
			
				this.y_axis_scale.domain(y_groups);
				this.x_axis_scale.domain(x_groups);

		
				this.setSize();
                this.fitToContainer();





            }

            _hide(items,length){
            	this.getAverages(items)
            	for (let p in this.matrix){
            		let fs = this.matrix[p];
            		for (let f in fs){
            			let val = fs[f];
            		    let color = null;
            			if (isNaN(val)){
            				color=[255,255,255];
            			}
            			else{
            				color = this.convertToRGB(this.color_scale(val));
            			}
            		   
                       this.app.setObjectColor(p+"|"+f,color);
            		}
            	}
            	this.app.refresh();
            	this.drawFrequencies();
            	
            }

            drawFrequencies(){
            	let self = this;
                let width = ((this.height-this.x_axis_height)/this.groups.length)-4;
                if (width<5){
                	width=5;
                }
                if (width>30){
                	width=30;
                }
            	this.y_axis_svg.selectAll("line").styles({"stroke":"purple","stroke-width":width}).attr("x2",function(d){
            		return -25* (self.group_to_count[d]/self.top_count);

            	});
            	this.y_axis_svg.selectAll("text").attr("x",-25);
            	this.x_axis_svg.selectAll("text").style("text-anchor","end").attrs({"transform":"rotate(-65)","dy":".10em","dx":"-.4em"});
       
            	
            	
            }

            setSize(x,y){
            	super.setSize(x,y);
            	this.drawFrequencies();
            	
          
            }

            updateScale(data){

		                this.y_axis_scale.domain([(data.y_range[0]/10)-0.5,(data.y_range[1]/10-0.5)]);
		                this.y_axis_svg.transition().call(this.y_axis_call);
		              
		                
		                this.x_axis_scale.domain([(data.x_range[0]/2-0.5),(data.x_range[1]/2)-0.5]);
		                this.x_axis_svg.transition().call(this.x_axis_call);

	        }

            getAverages(items){
            	let data  =this.ndx.getOriginalData();

            	let y_param= this.config.y_axis_category;
            	  
    	         for (let g of this.groups){
    	            	let p={};
    	            	for (let f of this.config.param ){
    	            		p[f]=[0,0];
    	            		
    	            	}
    	           	this.matrix[g.value]=p;
    	         }
            	
            	for (let item of data){
            		if (items && !(items[item.id])){
            			continue;
            		} 
            		let fs= this.matrix[item[y_param]];
            		for (let f in fs){
            			fs[f][0]+=item[f];
            			fs[f][1]+=1;
		
            		}
            	}
           
                let temp_data=[];
                let max = Number.MIN_SAFE_INTEGER;
                let min = Number.MAX_SAFE_INTEGER;
                this.top_count=0;
            	for (let p in this.matrix){
            		let fs = this.matrix[p];
            		this.group_to_count[p]=0;
            		for (let f in fs){
            			let num = fs[f][0]/fs[f][1];
            			this.group_to_count[p]+=fs[f][1];
            			max= Math.max(num,max)
            			min = Math.min(num,min);
                        fs[f] = num;
                        temp_data.push({"temp":num})
                        
            		}
            		this.top_count=Math.max(this.top_count,this.group_to_count[p])
            	}

            	if (!items){
            	    let info = FilterPanel.getColorScale({field:"temp",datatype:"double"},temp_data);
            	    this.color_scale= info.func;
            	    this.min_max=[min,max];
            	}
           
            }

            fitToContainer(){
	            
					let self =this;
					this.app.x_scale=this.app.width/(this.config.param.length*10);
					this.app.y_scale=this.app.height/(this.groups.length*10);
					this.app.offset=[0,0];

					//this.updateScale(this.app.getRange());
		        }

            convertToRGB(rgb){
		        rgb=rgb.substring(4,rgb.length-1);
		        return rgb.split(", ");
            }
}

MLVChart.chart_types["summary_heat_map"] ={
		        "class":WGLSummaryHeatMap,
		        name:"Heat Map",
		        params:"number"
		    }


class WGLHeatMap extends WGLChart{
	constructor(ndx,div,config,columns){
    		super(ndx,div,config);
    	            let self = this;
    	            this.type= "heat_map";
    	            let data  =ndx.getOriginalData();
    	            this.no_items= data.length;
    	            this.param=[];
    	            if (config.param.columnGroup){
    	            	for (let c of columns){
                            if (c.columnGroup===config.param.columnGroup){
                            	this.param.push(c.field)
                            }
    	            	}
    	            }
    	           
    	            else{
    	            	this.param = this.config.param;
    	            }

    	            this.listeners={};

    	            this.field_to_name={};
    	           
    	            this.field_to_order={};
    	            let count=0;
    	            let y_groups=[];
    	            for (let param of this.param){
    	            	this.field_to_order[param]=count;
    	            	count++;


    	            }
    	            

    	            this.cat_columns=[];

    	            if (config.field_to_name){
    	            	this.field_to_name=config.field_to_name;
    	            	for (let f in config.field_to_name){
    	            		y_groups[this.field_to_order[f]]=config.field_to_name[f]
    	            	}
    	            }
    	            else{
                   
						for (let c of columns){
							let o = this.field_to_order[c.field];
							if  (o !== undefined){
								this.field_to_name[c.field]=c.name;
								y_groups[o]=c.name;
							}
							if (c.datatype==="text"){
								this.cat_columns.push(c);
							}
						}
    	            }

    	            this.addAxis({
					   
					    //x_scale:"band",
					    y_axis_width:config.y_axis_width?config.y_axis_width:50,
					    x_axis_height:50,
					    right_y_axis:config.row_values?true:false
				    });
				    this.y_axis_scale.domain(this.param.length);
				    if (config.row_values){
				    	let arr=[];
				    	for (let i of this.config.row_values){
				    		arr.push(i);
				    	}
				    	this.right_y_axis_scale.domain(arr);
				    }

				   

				    
				 
    	            this.tooltip = $("<div>").css({
    	            	position:"absolute",display:"none","background-color":"yellow"
    	            }).appendTo($("body"));
    	          
    	            this.app = new WGL2DI(this.graph_id,50,50,{lock_x_axis:true});
    	            this.color_scales={};
    	            if (config.universal_color_scale && !(this.config.row_color_scale)){
    	            	this.updateUniversalScale();
    	            }
    	           
					for (let param of this.param){
						let info = FilterPanel.getColorScale({field:param,datype:"double"},this.ndx.getOriginalData());
						this.color_scales[param]=info.func;
					}
					if (!this.config.collapse_groups){
						this.addSquares(data);  
					}
					
                   //      
					
			
    	                       
    	            this.addHandlers();
                

               this.x_axis_call.tickFormat(function(v,i){
		            return "";
                });
                let arr=[];
                for (let i=0;i<this.param.length;i++){
                	arr.push(i);
                }
               this.y_axis_call.ticks(30).tickFormat(function(v,i){
                    let f= self.param[v];
                    if (f){
                    	return self.field_to_name[f];
                    }
			         
                });
                this.setSize();
                 
                this.fitToContainer();
                if (this.config.group_by){

                	if (!this.config.collapse_groups){
                		let info=this.groupData(this.config.group_by);       	   
                	    this.sortColumns(this.config.group_by,info);
                	}
                	else{
                		this.id_to_item={};
                		for (let item of data){
                			this.id_to_item[item.id]=item;
                			
                		}
                        this.groupData(this.config.group_by);     
                		this.addRectangles(this.id_to_item);


                	}
                	
                
                	

                }
                if (this.config.cluster){
                	this.clusterData();
                }






                }




                groupData(field){
                	this.sort_field=field;
		        	let li = groupAndOrder(this.ndx.getOriginalData(),field);
		        	let val_to_c={}
		        	let y_axis_data=[];
		        	let cs = FilterPanel.cat_color_schemes["Scheme 1"];
		        	let st=0;
		        	let index=0;
		        	for (let item of li){
                        val_to_c[item.value]=item.count;
		        	}
		        	let val_to_order={};

                    if (this.config.group_colors){
                    	if (this.config.group_colors[field]){
                    		let temp_li=[];
                    		cs=[];
                    		for (let item of this.config.group_colors[field]){
                                temp_li.push({value:item[0],count:val_to_c[item[0]]});
                                cs.push(item[1])
                    		}
                    		li=temp_li;
                    	}
                    }

		        	for (let item of li){
                        val_to_c[item.value]=item.count;
                        val_to_order[item.value]=index;
                        y_axis_data.push({start:st,color:cs[index],length:item.count,value:item.value});
                        st+=item.count;
                        index+=1
		        	}
		        
                    this.sort_field_to_count=val_to_c;
                    this.y_axis_data=y_axis_data;
                    let length = this.ndx.getOriginalData().length;
		        	if (this.id_to_item){
		        		length=this.calculateGroups(this.id_to_item);

		        	}
		         
		        
		            let sel = this.x_axis_svg.selectAll("rect").data(y_axis_data);
		        	sel.exit().remove();
		        	sel.enter().append("rect");

		        	sel = this.x_axis_svg.selectAll(".cat-text").data(y_axis_data);
		        	sel.exit().remove();
		        	sel.enter().append("text").attr("class","cat-text");
		        	sel=  this.x_axis_svg.selectAll(".cat-text");
		        	sel.attr("fill","black").text(function(d){
		        		return d.value;
		        	});
		        
		        	this.showXCategories();
		        	return {
		        		val_to_order:val_to_order,
		        		length:length
		        	}

                }
                remove(){
                	this.tooltip.remove();
                }

                addSquares(data,not_add){
                	if (!not_add){
                	    this.id_to_item={};
                	}
    	            let column=0;
    	            let pos=0;
    	            this.id_to_pos=[];
    	            for (let item of data){
    	            	let row=0;
    	            	if (!not_add){
    	            	    this.id_to_item[item.id]=item;
    	            	}
    	            	for (let param of this.param){
    	            		let val = item[param];
    	            		if (val===undefined){
    	            			continue;
    	            		}
    	            		let color =null;
    	            		if (this.universal_color_scale && !(this.config.row_color_scale)){
                                color = this.convertToRGB(this.universal_color_scale(val));
    	            		}
    	            		else{
    	            			color = this.convertToRGB(this.color_scales[param](val));
    	            		}
    	            	 
    	            	    let id=item.id+"|"+param;
    	            	    let y= this.field_to_order[param]*10;
    	            	    this.app.addRectangle([column*2,y],9,2,color,id);
    	            	    row++;
    	            	}
    	            	this.id_to_pos.push([item.id,pos,pos+row]);
    	            	pos+=row
    	            	column++;
                        
    	            }

                }

                addRectangles(){
                	let m = this.matrix;
    	            let y=0;
    	            for (let p of this.param){
    	            	let x=0
    	            	for (let c of this.cat_in_view){

    	            		let item = this.matrix[p][c[0]]
    	            		let len = c[1]*2;
    	            		if (item[1]!==0){
    	            			let color =null;
    	            		    if (this.universal_color_scale && !(this.config.row_color_scale)){
                                    color = this.convertToRGB(this.universal_color_scale(item[0]));
    	            		    }	  	 
    	            	        let id=c[0]+"|"+p;
    	            	        this.app.addRectangle([x,y],9,len,color,id);
    	            		}
    	            		x+=len;

    	            	   
    	            	}
    	            	y+=10;
    	            }
                       
    	            

                }

               _hide(items,length){
               	    if (this.sort_field){
                    	this.calculateGroups(items);
                    }
                    this.id_to_item=items;
                    if (!this.config.collapse_groups){
                        this.app.moveAndHide(items,this.id_to_pos,this.field_to_order,this.no_items);
                    }
                    else{
                    	this.app.removeAllObjects();
                    	this.addRectangles();
                    }
                    
                   
                    this.fitToContainer(length,true);
                    this.app.refresh();

                  
	            }

	           updateUniversalScale(){
	           	    let ucs = this.config.universal_color_scale;
	           	    let div_id = ucs.show_scale_bar?this.graph_id:null;
    	            let info = FilterPanel.getColorScale({field:"x",dataype:"double"},[{x:ucs.min},{x:ucs.max}],ucs.scheme,this.graph_id);
    	            this.universal_color_scale=info.func;
    	            if (!ucs.show_scale_bar){
    	            	$("#"+this.graph_id+"-bar").remove();
    	            }
	           }

	           collapseGroups(){
	               if (this.config.collapse_groups){
	               	    return
	               }
	               this.config.collapse_groups=true;
	               this.app.removeAllObjects();
	               this.groupData(this.config.group_by);     
                   this.addRectangles(this.id_to_item);
                   this.app.refresh();
	           }

	           uncollapseGroups(){
	               if (!this.config.collapse_groups){
	               	    return
	               }
	               this.app.removeAllObjects();
	               this.config.collapse_groups=false;
	               this.addSquares(this.ndx.getOriginalData(),true);
	               let info=this.groupData(this.config.group_by);       	   
                   this.sortColumns(this.config.group_by,info);
                   this._hide(this.id_to_item,Object.keys(this.id_to_item).length);
	           }


	           removeClusters(){
	           	        this.y_axis_width-=75;
	           	        this.y_tree.svg.remove();
	           	        delete this.y_tree;
	           	        delete this.config.cluster;
	           	        this.mask_div.remove();
	           	        this.setSize();
	           }


	           clusterData(){
	           	 this.fitToContainer(Object.keys(this.id_to_item).length);	           	    
	           	    let arr=[];
	           	    if (this.config.collapse_groups){
	           	    	for (let p in this.matrix){
	           	    		let row=[];
	           	    		let gr = this.matrix[p];
                            for (let g in gr){
                            	let v =gr[g];
                                row.push(isNaN(v[0])?0:v[0])
                            }
                            row._id=p;
                            arr.push(row);
	           	    	}
	           	    }
	           	    else{
						for (let p of this.param){
							let row=[]
							for (let i in this.id_to_item){
								let item=this.id_to_item[i];
								if (item[p]==null){
									row.push(0);
									continue;
								}
								row.push(item[p]);
							}
							row._id=p;
							arr.push(row);
						}
	           	    }
                     let hc  = new HierarchicalClustering();

                     hc.cluster(arr);
                     this.param=[];
                     for ( let i in hc.values){
                     	let p = hc.values[i];
                     	this.field_to_order[p]=i;
                     	this.param.push(p);
                     }

                     this.config.collapse_groups = !this.config.collapse_groups;
                     if (this.config.collapse_groups){
                     	 this.uncollapseGroups();
                     }
                     else{
                     	 this.collapseGroups();
                     }
                     let nodes = d3.hierarchy(hc.clusters[0],function(d){
            	        if (d.left){
            		        return [d.left,d.right];
            	        }
                      });

                      for (let node of nodes.descendants()){
                      	let d = node.data;
                      	delete d.left;
                      	delete d.right;
                      	delete d.size;
                      	if (d.value){
                      		d.id= d.value._id;
                      		d.pos=this.field_to_order[d.id];
                      		delete d.value;
                      	}

                      }
                     if (this.y_tree){
                     	 this.y_axis_width-=75;
                     }

                      let h=  this.height-this.x_axis_height;
                      let interval= h/this.param.length;
                    
                      let treemap = d3.cluster()
                          
                           .size([h, 75])
                         

                      nodes=treemap(nodes);
                      if (this.y_tree){
                            this.y_tree.svg.remove();
                          
                      }
                      this.y_axis_width+=75;
                      if (!this.y_tree){
                      	 this.mask_div= $("<div>").width(this.y_axis_width).height(this.x_axis_height)
                      	 .css({"z-index":10,position:"absolute",bottom:"0px","left":"0px","background-color":"white"});
                     	$("#"+this.graph_id).parent().append(this.mask_div);
                     
                      }
                     
                       
                      


                      let g = this.axis.append("g");//.attr("height",this.height-this.x_axis_height);

                  
                      let links= g.selectAll(".link")
                            .data( nodes.descendants().slice(1))
                             .enter().append("path")
                            .attr("class", "link")
                            .style("stroke","black")
                            .style("fill","none")
                            .style("stroke-width","1px");
                     /* let term_links=   g.selectAll(".tn").data(nodes.descendants().filter(
                            function(d){
	                            return !d.children
	                      })).enter().append("path")
                             .style("stroke","black")
                                .style("fill","none")
                                .style("stroke-width","1px");
                                */

                      this.y_tree={
                      	height:h,
                      	svg:g,
                      	links:links,
                      	scale:this.range.scale[1]//,
                         //term_links:term_links
                          }

                       

                             this.y_tree.links.attr("d", function(d) {
                         let p=d.x;
                        if (!d.children){
                        	 p =(interval/2)+(interval*d.data.pos);
                        }
                           return "M " +d.y + " " + (p)
                             + " L" +d.parent.y + " " + (p)
                         + " L" + d.parent.y + " " + (d.parent.x);
      
                       });
                        
                        let f = 75;//this.y_axis_width-75;
                   /*   this.y_tree.term_links
                    .attr("d", function(d,i) {
    	                let pos =(interval/2)+(interval*d.data.pos);
                           return `M ${d.y} ${pos} L ${f} ${pos}`;
       
                  });*/
                
                        setTimeout(()=>{this.setSize();},50)
                       this.config.cluster=true;
                       this.drawTree(this.range);
                      
                    
                    
                    
	           }

	        
	           drawTree(){
	           	let range=this.range
	           	   
	               	let h = this.height-this.x_axis_height;
	              
	              

	               	let f = this.range.scale[1]/this.y_tree.scale;
	               	 let offset =this.range.offset[1]*this.y_tree.scale;
                    let xw=this.y_axis_width;
	             
	               this.y_axis_svg.attr("transform",`translate(${xw-75})`);
	               	 this.y_tree.svg.attr("transform",`scale(1,${f}) translate(${xw-75},${offset})`)
	               	 this.y_tree.svg.selectAll("path").attr("stroke-width",(1/f)+"px")
                   
                 

	           }

	           groupBy(field){
	               this.config.group_by=field;
	               if (!this.config.collapse_groups){
                		let info=this.groupData(this.config.group_by);       	   
                	    this.sortColumns(this.config.group_by,info);
                	}
                	else{
                		
                        this.groupData(this.config.group_by);
                        this.calculateGroups(this.id_to_item);
                        this.app.removeAllObjects();    
                		this.addRectangles(this.id_to_item);
                		this.app.refresh();

                	}
	           }

	           refreshColors(){
	               if (!this.config.collapse_groups){
	           	       /*for (let item of this.ndx.getOriginalData()){  	            	
    	            	    for (let param of this.param){
								let val = item[param];
								if (val===undefined){
									continue;
								}
								let color=null;
								if (this.universal_color_scale && !(this.config.row_color_scale)){
									 color = this.convertToRGB(this.universal_color_scale(val));
								}
								else{
									color = this.convertToRGB(this.color_scales[param](val));
								}
								let id=item.id+"|"+param;
								this.app.setObjectColor(id,color)
    	            	    } 
    	            	
	           	       }*/
	           	        this.app.removeAllObjects();
	            
	               this.addSquares(this.ndx.getOriginalData(),true);
	               let info=this.groupData(this.config.group_by);       	   
                   this.sortColumns(this.config.group_by,info);
                   this._hide(this.id_to_item,Object.keys(this.id_to_item).length);

	               }
	               else{
                        this.app.removeAllObjects();
                        this.calculateGroups(this.id_to_item) 
                		this.addRectangles();

	               }
	               
	           	   this.app.refresh();

    	            
	           }


                calculateGroups(items){
                	let t= this.config.collapse_groups;
                	if (t){
                		this.matrix={};
                		this.cat_in_view=[];
                		for (let p of this.param){
                			let o={};
                			for (let i in this.sort_field_to_count){
                				o[i]=[0,0];
                			}
                			this.matrix[p]=o;
                		}
                	}
                	let val_to_c={};
                    	for (let v in this.sort_field_to_count){
                    		val_to_c[v]=0;
                    	}
                    	for (let id in items){
                    		let cat = items[id][this.sort_field];
                    		if (cat === null){
                    			cat="none"
                    		}
                            val_to_c[cat]++;
                            if (t){
                                for (let p of this.param){
                                	let v= items[id][p];
                                	
                                	if (v!=null){
                                		this.matrix[p][cat][0]+=v;
                                		this.matrix[p][cat][1]+=1;
                                	}
                                	
                                }
                            }

                    	}
                    	let st=0;
                    	for (let item of this.y_axis_data){
                    		let c = val_to_c[item.value];
                    		item.start=st;
                    		item.length=c;
                    		st+=c;
                    		if (t && c!==0){
                    			this.cat_in_view.push([item.value,c]);
                    		}
                    		
                    	}
                    	if (t){
                    		for (let p of this.param){
                    			for (let c of this.cat_in_view){
                    				let v= this.matrix[p][c[0]][0];
                    				let n =  this.matrix[p][c[0]][1];                  				
                    				this.matrix[p][c[0]][0]=v/n;
                    			}

                    		}
                    	}
                    	return st;

                }

                setTooltip(tooltip){
                	this.config.tooltip=tooltip
                }

                drawRightYValues(){
					let self = this;
					let width = ((this.height-this.x_axis_height)/this.config.row_values.length)-4;
					if (width<5){
						width=5;
					}
					if (width>40){
						width=40;
					}
					this.right_y_axis_svg.selectAll("line").styles({"stroke":"black","stroke-width":width}).attr("x2",function(d){
						return d;

					});
					this.right_y_axis_svg.selectAll("text").attr("opacity",0);
					
					
      
            	
            }








				addHandlers(){
					let self=this;
					this.app.addHandler("zoom_stopped",function(data){
						self.updateScale(data)
					});
					this.app.addHandler("panning_stopped",function(data){
						self.updateScale(data)
					});
					this.app.addHandler("object_over",function(object_id,e){
						let tt= self.config.tooltip;
						if (!tt){
							return;
						}
						let arr = object_id.split("|");
						if (self.config.collapse_groups){
                            let value= self.matrix[arr[1]][arr[0]];
                            let cell ="<b>Category:</b>"+arr[0]+"<br>";
							let field = "<b>"+tt.y_name+":</b>"+self.field_to_name[arr[1]]+"<br>";
							let val = "<b>Value:<b>"+value[0];
									self.tooltip.css({top:(e.clientY-3)+"px",left:(e.clientX+3)+"px"})
									.html(cell+field+val)
									.show();



						}
						else{
							let item =self.id_to_item[arr[0]];
						    if (item){
								let cell ="<b>"+tt.x_name+":</b>"+item[tt.x_field]+"<br>";
								let field = "<b>"+tt.y_name+":</b>"+self.field_to_name[arr[1]]+"<br>";
								let val = "<b>Value:<b>"+(self.id_to_item[arr[0]][arr[1]]);
									self.tooltip.css({top:(e.clientY-3)+"px",left:(e.clientX+3)+"px"})
									.html(cell+field+val)
									.show();
						    }

						}
						
						
				     });
				     this.app.addHandler("object_out",function(object_id,e){
				     	self.tooltip.hide();
				     });

				  
				}


                updateScale(data){
                	this.range=data;
                	     this.y_axis_scale.domain([(data.y_range[0]/10)-0.5,(data.y_range[1]/10)-0.5]);
		                this.y_axis_svg.transition().call(this.y_axis_call);
		                let self =this;
		                  	if (this.config.clickable_y_axis){
                    this.y_axis_svg.selectAll("text").on("click",function(d){
        	            for (let l in self.listeners){
        	            	self.listeners[l]("y_axis_clicked",{field:self.param[d]})
        	            }
        	        }).classed("mlv-hm-label",true);

            	    }
		                this.x_axis_scale.domain([(data.x_range[0]/2-0.5),(data.x_range[1]/2)-0.5]);
		                this.x_axis_svg.transition().call(this.x_axis_call);
		                this.showXCategories();
		                if (this.y_tree){
		                	this.drawTree(data);
		                }

	            }

	            fitToContainer(no_items,x_only){
	            	if (!no_items){
	            		no_items=this.no_items;
	            	}
					let self =this;
					this.app.x_scale=this.app.width/(no_items*2);
					if (!x_only){
					    this.app.y_scale=this.app.height/(this.param.length*10);
					}
					if (x_only){
	            		this.app.offset=[0,this.app.offset[1]];
	            	}
	            	else{
					    this.app.offset=[0,0];
	            	}

					this.updateScale(this.app.getRange());
		        }

		        addListener(id,func){
		        	this.listeners[id]=func;
		        }
		        removeListener(id){
		        	delete this.listeners[id];
		        }


		        sortColumns(field,info){
		        	
		        	
		            let self =this;
		            let val_to_order = info.val_to_order
		        	this.id_to_pos.sort(function(a,b){
		        		let ac1= self.ndx.getItemById(a[0])[field];
		        		let ac2= self.ndx.getItemById(b[0])[field]
		        		ac1=(ac1===null)?"none":ac1;
                        ac2=(ac2===null)?"none":ac2;
		        		let ac= val_to_order[ac1];
		        		let bc= val_to_order[ac2];
		        		return ac-bc;

		        	});
		        	this.app.moveAndHide(this.id_to_item,this.id_to_pos,this.field_to_order,this.no_items);
		        	
                    this.fitToContainer(info.length,true);
                    this.app.refresh();
		        }


		    setSize(x,y){
            	super.setSize(x,y);
            	let self =this;
            	if (this.config.row_values){
                    this.drawRightYValues();
            	}
            	if (this.config.clickable_y_axis){
                    this.y_axis_svg.selectAll("text").on("click",function(d){
                    	let f = self.param[d]
        	            for (let l in self.listeners){
        	            	self.listeners[l]("y_axis_clicked",{field:f})
        	            }
        	        }).classed("mlv-hm-label",true);

            	}
            	this.range=this.app.getRange();
            	
           
            	
            	this.showXCategories();
            	 	if (this.y_tree){
                     this.drawTree();

            	}
            
          
            }

            

            showXCategories(){
            	let self = this;
            	this.x_axis_svg.selectAll("rect").attr("transform",function(d){
		        		let st = self.x_axis_scale(d.start-0.5);
		        		return "translate("+st+",0)";
		        		
		        	}).attr("width",function(d){
		        		let st = self.x_axis_scale(d.start-0.5);
		        		let en = self.x_axis_scale(d.start+d.length+1);
		        		return (en-st)+"px";
		        	})
		        	.attr("height","10px")
		        	.attr("fill",function(d){
		        		return d.color;
		        	});
            	this.x_axis_svg.selectAll(".cat-text").attr("transform",function(d){
		        		let st = self.x_axis_scale(d.start-0.5);
		        		let en = self.x_axis_scale(d.start+d.length+1);
		        		let pos =st+((en-st)/2);
		        		return "translate("+pos+",14) rotate(-35)";
		        		
		        
		        	})
		        	.attr("opacity",function(d){
		        		return d.length===0?0:1;

		        	})

		        	.style("text-anchor","end");

		        	
		        
            }

	





                convertToRGB(rgb){
		            rgb=rgb.substring(4,rgb.length-1);
		            return rgb.split(", ");
                }

                updateAxis(){
                    this.x_axis_scale.range([0,width-this.y_axis_width]).domain([0,this.no_items]);
					this.y_axis_scale.range([0,height-this.x_axis_height]).domain([0,this.param.length]);
                    
                }

			}


	class WGLHeatMapDialog extends MLVChartDialog{
        constructor(graph){
            super(graph);     
        }

   


    _init(){
    	let cs = this.graph.config.universal_color_scale;
        let self =this;
        if (cs){
            $("<input>").attr({type:"radio",name:"hm-color-scale",value:"row"})
             .prop("checked",this.graph.config.row_color_scale)
             .appendTo(this.div);

        	this.div.append($("<label>Scale By Row</label>").css("display","inline-block")).append("<br>");
        	 $("<input>").attr({type:"radio",name:"hm-color-scale",value:"universal"})
             .prop("checked",!this.graph.config.row_color_scale)
             .appendTo(this.div);
        	this.div.append($("<label>Universal Color Scale</label>").css("display","inline-block")).append("<br>");
        	let scheme_div=$("<div>").appendTo(this.div);
            scheme_div.append("<b>Scheme:</b>");
            this.scheme_select = $("<select>").appendTo(scheme_div).css("margin-bottom","4px");
            this.sb_id = "bar"+this.graph.getRandomString();
            $("<div>").css({height:"30px"}).attr("id",this.sb_id).appendTo(scheme_div);
     	    let schemes=FilterPanel.color_schemes;
    	    for (let scheme in schemes){
               this.scheme_select.append($('<option>', {
	           value: scheme,
	           text: scheme
	           }));   
			}
			if (cs.scheme){
				this.scheme_select.val(cs.scheme);
			}
			this.showScaleBar(this.scheme_select.val());
			this.scheme_select.change(function(e){
				self.showScaleBar($(this).val());
			})
			scheme_div.append("<br>");
			let input =$("<input>");
     	    scheme_div.append("<span>Min:<span>").append(input);
     	    input.css({width:"65px",height:"20px","margin-left":"2px","margin-right":"2px"})
    		.appendTo(scheme_div)
    		input.val(cs.min)
    		this.mins_input=input;
            
            input =$("<input>");
    		scheme_div.append("<span>Max:<span>").append(input);
     	    input.css({width:"65px",height:"20px","margin-left":"2px","margin-right":"2px"})
    		.appendTo(scheme_div)
    		input.val(cs.max)
    		this.maxs_input=input;
    		scheme_div.append("<span>Show Scale Bar</span>");
    		this.show_scale= $("<input>").attr("type","checkbox")
    		.prop("checked",cs.show_scale_bar).appendTo(scheme_div)
    		
    		scheme_div.append("<br>");
            $("<button>").attr("class","btn btn-sm btn-secondary").text("update").click(function(e){
            	self.updateScale();
            }).appendTo(scheme_div);


        }
    }

    showScaleBar(scheme){
    	let ucs = this.graph.config.universal_color_scale;
        let info = FilterPanel.getColorScale({field:"x",dataype:"double"},[{x:ucs.min},{x:ucs.max}],scheme,this.sb_id);
        $("#"+this.sb_id+"-bar").css({top:"-8px",left:"20px"});
    }

    updateScale(){
    	    let type =$("input[name='hm-color-scale']:checked").val();
        	this.graph.config.universal_color_scale={
        		scheme:this.scheme_select.val(),
        		min:parseFloat(this.mins_input.val()),
        		max:parseFloat(this.maxs_input.val()),
        		show_scale_bar:this.show_scale.prop("checked")
        	}
        	if (type==="universal"){
        		this.graph.config.row_color_scale=false;
        		this.graph.updateUniversalScale();
        	}
        	else{
        		this.graph.config.row_color_scale=true;
        	}
        	
        	this.graph.refreshColors();
        }
       
    	
     

}




		MLVChart.chart_types["heat_map"] ={
		        "class":WGLHeatMap,
		        name:"Heat Map",
		        params:"number",
		        dialog:WGLHeatMapDialog
		    }


export {WGLHeatMap};