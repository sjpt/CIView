import {regl} from "./regl.js";


class WGL2DI{
	/** 
    * Creates a new wg2di instance
    * @param {string|object} div - The id of the div to house the instance or jquery element
    * @param {integer} width - The width of the instance (optional- will be the width of the parent div if not supplied)
    * @param {integer} height - The height  of the instance (optional- will be the height of the parent div if not supplied)
    * @param {object} config (optional)
    * <ul>
    * <li> in_view_only - if true then only those objects in view will be drawn after panning/zooming.This will
    * speed things up if maniluplating individual objects but slow down panning and zooming</li>
    * <li> allow_object_drag - if true individual objects can be dragged </li>
    * <li> default_brush - if true then brushing will be the default drag behavior - uses shift for panning
    *  Otherwise panning is default and shift used for brushing
	*
    * </ul>
    */
	constructor(div,width,height,config){
		var self = this;
		if (!config){
			config={};
		}
		this.config=config;

	
    
    	this.regl=null;
		this.pick_buffer=null;
		this.objects=[];
		this.keys={};
		this.object_types=[];
		this.objects_in_view=0;
		//html elements
		if (typeof div === "string"){
			this.div_container=$("#"+div);
		}
		else{
			this.div_container=div;
		}
		this.canvas=null;
		this.label_context;
		this.label_context=null;
		this.height=0;
		this.width=0;
		this._setUpDocument(width,height);
		this.images_to_load=0;
		this.is_filtered={};
		this.is_hidden={};
    
		//handlers
		this.handlers={
			object_clicked:{},
			object_over:{},
			object_out:{},
			brush_stopped:{},
			zoom_stopped:{},
			panning_stopped:{},
		};

		//switches
		this.draw_labels=false;

		//circle shapes
		this.circle_properties={"position":1,"color":1,"pick_color":1,"radius":1,"start_angle":1,"end_angle":1,"opacity":1};
		this.circles_to_draw={};
		this.circles={};
		for (var prop in this.circle_properties){
			this.circles_to_draw[prop]=[];
			this.circles[prop]=[];
		}
		this.circles.count=0;
		this.object_types.push({data:this.circles,
								data_in_view:this.circles_to_draw,
								properties:this.circle_properties,
								vertices:1,
							primitive:"points"});

		this.universal_circle_radius=0;

		//line shapes
		this.line_properties={'position':2,"color":2,"pick_color":2};
		this.lines_to_draw={};
		this.lines={};
		for (var prop in this.line_properties){
			var list=[];
			this.lines[prop]=list;   
			this.lines_to_draw[prop]=list;
		}
		this.lines.count=0;
		this.object_types.push({data:this.lines,
								data_in_view:this.lines_to_draw,
								properties:this.line_properties,
								vertices:2,
								primitive:"lines"});

		//rectangles
		this.rect_properties={'position':2,"color":2,"pick_color":2};
		this.rects_to_draw={};
		this.rects={};
		for (var prop in this.rect_properties){     
			this.rects[prop]=[];   
			this.rects_to_draw[prop]=[];
		}
		this.rects.count=0;

		this.object_types.push({data:this.rects,
								data_in_view:this.rects_to_draw,
								properties:this.rect_properties,
								vertices:6,
								primitive:"triangles"});


		//squares
		this.square_properties={'position':2,"color":2,"pick_color":2,side_length:2,"right_clip":1,"bottom_clip":1};
		this.squares_to_draw={};
		this.squares={};
		for (var prop in this.square_properties){     
			this.squares[prop]=[];   
			this.squares_to_draw[prop]=[];
		}
		this.squares.count=0;
		this.object_types.push({data:this.squares,
								data_in_view:this.squares_to_draw,
								properties:this.square_properties,
								vertices:1,
								primitive:"points"});


		this.scale=1.0;
		this.x_scale=1.0;
		this.y_scale=1.0;
		this.offset=[0,0];


		//images
		this.image_properties={'position':2,"pick_color":2,"color":2,"opacity":2};
		this.images_to_draw={};
		this.images={};
		for (var prop in this.image_properties){     
			this.images[prop]=[];   
			this.images_to_draw[prop]=[];
		}
		
		this.images.count=0;
		this.images.props=[];
		this.images.globals=[this.offset[0],this.offset[1],this.x_scale,this.y_scale];
		this.object_types.push({data:this.images,
								data_in_view:this.images_to_draw,
								properties:this.image_properties,
								vertices:6,
								primitive:"triangles"});
	    this.images.display_as_image=true;

        

        //image tiles
	    this.imagetile_properties={'position':2,"pick_color":2,"color":2,"opacity":2,"x_y":2,"c_r":2};
		this.imagetiles_to_draw={};
		this.imagetiles={};
		for (var prop in this.imagetile_properties){     
			this.imagetiles[prop]=[];   
			this.imagetiles_to_draw[prop]=[];
		}
		
		this.imagetiles.count=0;
		this.object_types.push({data:this.imagetiles,
								data_in_view:this.imagetiles_to_draw,
								properties:this.imagetile_properties,
								vertices:6,
								primitive:"triangles"});




		//The last mouse position recorded
		this.mouse_position=null;
		//Was an object clicked
		this.object_clicked=null;
		//an object was clicked
		this.dragging=false;
		//object which mouse is over
		this.object_mouse_over=null;
		this.mouse_over_color=null;//[255,0,0];

		this.zoom_amount=0;



		

		regl({
			onDone: function(err,regl){
				self.regl=regl;
				self.pickbuffer = regl.framebuffer({ colorFormat: 'rgba',height:self.height,width:self.width});
				self._initDrawMethods();
				self._addHandlers();
				 
			},
			canvas:self.canvas[0],
			

		});

	}

	animateTo(settings,iterations,callback){

		let offset=settings.offset?settings.offset:app.offset;
		let x_scale=settings.x_scale?settings.x_scale:app.x_scale;
		let y_scale=settings.y_scale?settings.y_scale:app.y_scale;
		if (!iterations){
			iterations=50
		}
		let app = this;
		let fac=40;
		let offset_interval = [Math.abs(offset[0]-app.offset[0])/iterations,Math.abs(offset[1]-app.offset[1])/iterations];
		let x_interval = Math.abs(x_scale-app.x_scale)/iterations;
		let y_interval = Math.abs(y_scale-app.y_scale)/iterations;
		let loop =app.regl.frame(function(){
			let change=false;
			if (app.offset[1]<offset[1]){
				app.offset[1]+=offset_interval[1];
				if (app.offset[1]>offset[1]){
					app.offset[1]=offset[1];
				}
				change=true;
			}
			if (app.offset[1]>offset[1]){
				app.offset[1]-=offset_interval[1];
				if (app.offset[1]<offset[1]){
					app.offset[1]=offset[1];
				}
				change=true;
			}
			if (app.offset[0]<offset[0]){
				app.offset[0]+=offset_interval[0];
				if (app.offset[0]>offset[0]){
					app.offset[0]=offset[0];
				}
				change=true;
			}
			if (app.offset[0]>offset[0]){
				app.offset[0]-=offset_interval[0];
				if (app.offset[0]<offset[0]){
					app.offset[0]=offset[0];
				}
				change=true;
			}
			if (app.x_scale<x_scale){
				app.x_scale+=x_interval;
				if (app.x_scale>x_scale){
					app.x_scale=x_scale;
				}
				change=true;
			}
			if (app.x_scale>x_scale){
				app.x_scale-=x_interval;
				if (app.x_scale<x_scale){
					app.x_scale=x_scale;
				}
				change=true;
			}
			if (app.y_scale<y_scale){
				app.y_scale+=y_interval;
				if (app.y_scale>y_scale){
					app.y_scale=y_scale;
				}
				change=true;
			}
			if (app.y_scale>y_scale){
				app.y_scale-=y_interval;
				if (app.y_scale<y_scale){
					app.y_scale=y_scale;
				}
				change=true;
			}


			if (change){
				app._drawObjects(false);
			}
			else{
				loop.cancel();
				loop=null;
				app._drawPickBuffer(false);
				app._getObjectsInView();
				app.refresh(true);
				if (callback){
					callback(app.getRange());
				}
			}

		});
	}



	removeAllObjects(){
		for(let ob of this.object_types){
			for (let prop in ob.data){
				if (prop==="count"){
					ob.data[prop]=0;
					continue;
				}
				ob.data[prop]=[];
			}
			for (let prop in ob.data_in_view){
				if (prop==="count"){
					ob.data_in_view[prop]=0;
					continue;
				}
				ob.data_in_view[prop]=[];
			}
		}

		this.objects=[];
		this.keys={};
		
	}


	_setUpDocument(width,height){
		if (this.config.default_brush){
			this.div_container.css("cursor","crosshair")
		}
		if (!height){
			this.height=height=this.div_container.height();
			this.width =width=this.div_container.width();

		}else{

			this.height=height;
			this.width=width;
			this.div_container.height(height);
			this.div_container.width(width);
		}
		this.canvas =$("<canvas>")
		.attr({
			height:height,
			width:width   
		})
		.css({
			position:"absolute",
			left:"0px",
			right:"0px"
		});
		this.label_canvas=$("<canvas>")
	   .attr({
			height:height,
			width:width   
		})
		.css({
			position:"absolute",
			left:"0px",
			right:"0px"
		});
		this.label_context=this.label_canvas[0].getContext("2d");
		this.div_container.append(this.canvas).append(this.label_canvas);
	}

	resizeImage(i){
		this.imagetiles.image_scale=i;
		this.maintainImageDimensions();
	}


	setImageSize(height,width){
		this.images.default_size=[height,width];
		this.images.scale_factor=1;
	}




	maintainImageDimensions(){
		if (this.imagetiles.count===0){
			return;
		}
		let width = this.imagetiles.width*this.imagetiles.image_scale;
		let height = this.imagetiles.height*this.imagetiles.image_scale;
		let t_height= height*this.y_scale;
		let t_width = width*this.x_scale;
		if (this.x_scale>this.y_scale){
			width= (this.imagetiles.ratio*height*this.y_scale)/this.x_scale;
		}
		if (this.y_scale>this.x_scale){
			height = (this.imagetiles.ratio*width*this.x_scale)/this.y_scale;
		}
		let pos = this.imagetiles.position;
		let max= pos.length-6
		for (let n=0;n<=max;n+=6){
			let x= this.imagetiles.x_y[n][0];
			let y = this.imagetiles.x_y[n][1];
			pos[n+1][1]=y+height;
			pos[n+2][0]=x+width;
			pos[n+2][1]=y+height;
			pos[n+3][0]=x+width;
			pos[n+3][1]=y+height;
			pos[n+4][0]=x+width;
		}
		
		this.imagetiles.i_w_h = [width,height];
		this.imagetiles.w_h=[width*this.imagetiles.sprite_dim[0],height*this.imagetiles.sprite_dim[1]];
	}



		
	

	setSize(width,height){
		let self=this;
		width=Math.round(width);
		height=Math.round(height);
		let x_ratio=width/this.width;
	    let y_ratio=height/this.height;
	  
		this.x_scale= this.x_scale*x_ratio;
		this.y_scale= this.y_scale*y_ratio;
		this.maintainImageDimensions();
	
		this.height=height;
		this.width=width;
		this.div_container.height(height).width(width);
		this.canvas.attr({height:height,width:width});
		this.label_canvas.attr({height:height,width:width});
		this.pickbuffer.destroy()
		this.pickbuffer = this.regl.framebuffer({ colorFormat: 'rgba',height:height,width:width});
		//this is necessary, but I  don't know why?
		let loop =this.regl.frame(function(){
			
		});
		setTimeout(()=>{

			self.refresh();
			loop.cancel();

			},100);
		


	}

	_getMousePosition(e){
    	var rect = this.canvas[0].getBoundingClientRect();
    	return [e.originalEvent.clientX-rect.left,e.originalEvent.clientY-rect.top];
	}

	_getActualPosition(position){
    	var x = (position[0]/this.x_scale) - this.offset[0];
    	var y = (position[1]/this.y_scale) - this.offset[1];
    	return [x,y];
	}

	getRange(){
		let tl = this._getActualPosition([0,0]);
		let br = this._getActualPosition([this.width,this.height]);
		return {
			x_range:[tl[0],br[0]],
			y_range:[tl[1],br[1]]
		};
	}

	_drawLabels(){
    	var time =Date.now();
    	if (this.objects_in_view>5000){
        	return;
    	}
    	this.label_context.font = "14px Arial";
   
    	for(var i in this.object_types){
        	var pos =this.object_types[i].data_in_view.position;
        
        	for (var ii=0;ii<pos.length;ii++){
       
          		var x=(pos[ii][0]+this.offset[0])*this.x_scale;
          		var y=(pos[ii][1]+this.offset[1])*this.y_scale;
                
             	this.label_context.fillText("H1",x,y);
           
        	}
    	}    
	}

	setObjectColor(key,color){
		var obj = this.objects[this.keys[key]];
		if (!obj){
			return;
		}
		var obj_type= this.object_types[obj[1]];
		for (var x=obj[0];x<obj[0]+obj_type.vertices;x++){
			obj_type.data.color[x][0]=color[0]/255;
			obj_type.data.color[x][1]=color[1]/255;
			obj_type.data.color[x][2]=color[2]/255;
		}
	}




	setUniversalCircleRadius(value){
		if (!value || isNaN(value)){
			value=0;
		}
		this.universal_circle_radius=value;
	}

	getUniversalCircleRadius(){
		return this.universal_circle_radius;
	}


	getObjectColor(key){
		var obj = this.objects[this.keys[key]];
		var obj_type= this.object_types[obj[1]];
		var col= obj_type.data.color[obj[0]];
		return [col[0]*255,col[1]*255,col[2]*255];

	}




	addLine(positionTo,positionFrom,color,key){
    	var index = this.objects.length;
    
     	if (key && ! this.keys[key]){
        	this.keys[key]=index;
    	}
    	else{
        	key=index;
        	this.keys[index]=index;
    	}
		var line_index=this.lines.position.length;
		this.lines.position.push(positionFrom);
		this.lines.position.push(positionTo);
		this.lines.color.push([color[0]/255,color[1]/255,color[2]/255]);
		this.lines.color.push([color[0]/255,color[1]/255,color[2]/255]);
		this.lines.pick_color.push(this._getRGBFromIndex(index+1));
		this.lines.pick_color.push(this._getRGBFromIndex(index+1));
		this.objects.push([line_index,1,key]);
		this.lines.count++;
	}

	addThickLine(positionTo,positionFrom,width,color,key){
		var index = this.objects.length;
		if (key && ! this.keys[key]){
			this.keys[key]=index;
		}
		else{
			key=index;
			this.keys[index]=index;
		}
		var rect_index=this.rects.position.length;
		var x_diff= positionTo[0]-positionFrom[0];
		var y_diff = positionTo[1]-positionFrom[1];
		var factor = (0.5*width)/Math.sqrt((x_diff*x_diff)+(y_diff*y_diff));
		var x_offset= factor*y_diff;
		var y_offset= factor*x_diff;
		this.rects.position.push([positionTo[0]+x_offset,positionTo[1]-y_offset]); //TL
		this.rects.position.push([positionFrom[0]+x_offset,positionFrom[1]-y_offset]); //BL
		this.rects.position.push([positionFrom[0]-x_offset,positionFrom[1]+y_offset]); //BR

		this.rects.position.push([positionFrom[0]-x_offset,positionFrom[1]+y_offset]); //BR
		this.rects.position.push([positionTo[0]-x_offset,positionTo[1]+y_offset]); //TR
		this.rects.position.push([positionTo[0]+x_offset,positionTo[1]-y_offset]); //TL


		var c  = [color[0]/255,color[1]/255,color[2]/255];
		var pc = this._getRGBFromIndex(index+1);
		for (var a=0;a<6;a++){
			 this.rects.color.push(c);
			 this.rects.pick_color.push(pc);
		}
		this.objects.push([rect_index,2,key]);
		this.rects.count++;
		return key;
	}


	addImageTile(sprite_sheets,config,positions,callback){
		let height = config.image_height;
		let width = config.image_width;
	    this.imagetiles.width=width;
	    this.imagetiles.height=height;
	    this.imagetiles.original_dim=[width,height];
	    this.imagetiles.ratio = width/height;
	    this.imagetiles.image_scale=1;
	    
		this.imagetiles.w_h=[width*config.sprite_dim[0],height*config.sprite_dim[1]];
		this.imagetiles.i_w_h=[width,height];

		this.imagetiles.sprite_dim=config.sprite_dim
	
		for (let pos of positions){
			var index = this.objects.length;
			
			this.keys[pos.key]=index;
		
			let x = pos.x;
			let y = pos.y;
			
			let imagetile_index=this.imagetiles.position.length;
			this.imagetiles.position.push([x,y]);
			this.imagetiles.position.push([x,y+height]);
			this.imagetiles.position.push([x+width,y+height]),
			this.imagetiles.position.push([x+width,y+height]);
			this.imagetiles.position.push([x+width,y]);
			this.imagetiles.position.push([x,y]);
		
			let pc = this._getRGBFromIndex(index+1);
			let x_y = [x,y];
			let c_r = [pos.sheet,pos.col,pos.row]
			for (var a=0;a<6;a++){
				this.imagetiles.pick_color.push(pc);
			 	this.imagetiles.color.push([1,1,1]);
			 	this.imagetiles.opacity.push(1.0);
			 	this.imagetiles.x_y.push(x_y);
			 	this.imagetiles.c_r.push(c_r);
			}
			this.imagetiles.count++;


			this.objects.push([imagetile_index,5,pos.key]);

		}
	
       
        let promises=[];
        let self =this;
        for (let n=0;n<5;n++){
        	if (sprite_sheets[n]){
				promises.push(this.loadSpriteSheet(sprite_sheets[n],n))
        	}
        	else{
        		self.imagetiles["text"+n]=this.regl.texture({shape: [1, 1]})

        	}
        }
        Promise.all(promises).then(function(){
        	callback();
        })
       

	}


	loadSpriteSheet(url,index){
		let self =this;
		return new Promise(function(fulfill){
			var im = new Image();
			im.onload=function(){

             	self.imagetiles["text"+index]=self.regl.texture({data:im,min:"linear"});
              	fulfill()
        	}

        	im.src = url;
        
		})
	}


	addImage(position,height,width,image,key){
		let self =this;
		var index = this.objects.length;
		if (key && ! this.keys[key]){
			this.keys[key]=index;
		}
		else{
			key=index;
			this.keys[index]=index;
		}
		let x = position[0];
		let y = position[1];
		var image_index=this.images.position.length;
		this.images.position.push([x,y]);
		this.images.position.push([x,y+height]);
		this.images.position.push([x+width,y+height]),
		this.images.position.push([x+width,y+height]);
		this.images.position.push([x+width,y]);
		this.images.position.push([x,y]);
		this.image_position=[[-1,1],[-1,0],[0,0],[0,0],[0,1],[-1.0]];
		var pc = this._getRGBFromIndex(index+1);
		for (var a=0;a<6;a++){
			 this.images.pick_color.push(pc);
			 this.images.color.push([1,1,1]);
			 this.images.opacity.push(1.0);
		}
		let i_index=this.images.props.length;

		this.images.props.push({count:6,is_buffer:0,x_y:[x-width,y-(width)],w_h:[width*3,height*3],opacity:this.images.opacity.slice(image_index,image_index+6),
		text:this.loading_image,text2:this.loading_image,position:this.images.position.slice(image_index,image_index+6),globals:this.images.globals,color:this.images.color.slice(image_index,image_index+6)});
		
		var im = new Image(128,128);
        im.src = image;
        im.width
        this.images_to_load++;
        im.onload=function(){
              self.images.props[i_index].text=self.regl.texture({data:im,min:"linear",mipmap:true,width:128,height:128});
              self.images_to_load--;
        }
        this.images.count++;


		this.objects.push([image_index,4,key,i_index]);


	}

	addRectangle(position,height,width,color,key){
		var index = this.objects.length;
		if (key && ! this.keys[key]){
			this.keys[key]=index;
		}
		else{
			key=index;
			this.keys[index]=index;
		}
		var rect_index=this.rects.position.length;
		this.rects.position.push(position);
		this.rects.position.push([position[0],position[1]+height]);
		this.rects.position.push([position[0]+width,position[1]+height]);

		this.rects.position.push([position[0]+width,position[1]+height]);
		this.rects.position.push([position[0]+width,position[1]]);
		this.rects.position.push([position[0],position[1]]);


		var c  = [color[0]/255,color[1]/255,color[2]/255];
		var pc = this._getRGBFromIndex(index+1);
		for (var a=0;a<6;a++){
			 this.rects.color.push(c);
			 this.rects.pick_color.push(pc);
		}
		this.objects.push([rect_index,2,key]);
		this.rects.count++;
		return key;
	}	

	addArc(position,radius,color,start_angle,end_angle,key){
		var index = this.objects.length;
		 if (key && ! this.keys[key]){
			this.keys[key]=index;
		}
		else{
			key=index;
			this.keys[index]=index;
		}
		var circ_index=this.circles.position.length;
		this.circles.position.push(position);
		this.circles.radius.push(radius);
		this.circles.color.push([color[0]/255,color[1]/255,color[2]/255]);
		this.circles.pick_color.push(this._getRGBFromIndex(index+1));
		this.circles.start_angle.push(start_angle);
		this.circles.end_angle.push(end_angle);
		this.objects.push([circ_index,0,key]);
		this.circles.count++;
	}


	addCircle(position,radius,color,key){
		var index = this.objects.length;
		 if (key && ! this.keys[key]){
			this.keys[key]=index;
		}
		else{
			key=index;
			this.keys[index]=index;
		}
		var circ_index=this.circles.position.length;
		this.circles.position.push(position);
		this.circles.radius.push(radius);
		this.circles.opacity.push(1);
		this.circles.color.push([color[0]/255,color[1]/255,color[2]/255]);
		this.circles.pick_color.push(this._getRGBFromIndex(index+1));
		this.circles.start_angle.push(10);
		this.circles.end_angle.push(0);
		this.objects.push([circ_index,0,key]);
		this.circles.count++;
	}

	addPointRectangle(position,height,width,color,key){
		var side_length= height>width?height:width;
		var index = this.objects.length;
		if (key && ! this.keys[key]){
			this.keys[key]=index;
		}
		else{
			key=index;
			this.keys[index]=index;
		}

		var square_index=this.squares.position.length;
		this.squares.position.push([position[0]+side_length/2,position[1]+side_length/2]);
		this.squares.color.push([color[0]/255,color[1]/255,color[2]/255]);
		this.squares.side_length.push(side_length);
		this.squares.right_clip.push(width/side_length);
		this.squares.bottom_clip.push(height/side_length);
		this.squares.pick_color.push(this._getRGBFromIndex(index+1));
		this.objects.push([square_index,3,key]);
		this.squares.count++;
	}




	_getRGBFromIndex(index){
		var b = Math.floor(index/65536);
		var temp = index%65536;
		var g= Math.floor(temp/256);
		var r = temp%256;
		return [r/255,g/255,b/255];
            
	}
	_getIndexFromRGB(rgb){
    	return (rgb[2]*65536)+(rgb[1]*256)+rgb[0];    
	}

	_drawPickBuffer(in_view){
       	this.regl.clear({
        	color: [0, 0, 0, 0],
			depth: 1,
        	framebuffer:this.pickbuffer
    	});
     	this._drawObjects(true,in_view);
    
	}
	//refesh all 
	//in_view only those in view
	refresh(in_view){
    	this.label_context.clearRect(0, 0, this.width, this.height);
    	this._drawObjects(false,in_view);
    	this._drawPickBuffer(in_view);
    	this.label_context.font = "30px Arial";
   
	}

	zoom(amount){
    	this.x_scale*=amount;
    	this.y_scale*=amount;
   		this._drawObjects(false);
	}

	_drawObject(object,color){
    
		var type =this.object_types[object[1]];
		var obj={
			stage_width:this.width,
			stage_height:this.height,
			x_scale:this.x_scale,
			y_scale:this.y_scale,
			buffer:null,
			offset:this.offset,
			count:type.vertices,
			primitive:type.primitive,
			is_buffer:0,
			universal_radius:this.universal_circle_radius

		};
	

		for (var prop in type.properties){   
			if (prop==='pick_color'){
				  continue;
			}
			obj[prop]=[];
			var st= object[0];
			var en =st+type.vertices;
			for (var pos=st;pos<en;pos++){
				if (prop!=='color'){
					obj[prop].push(type.data[prop][pos]);
				}
				else{
					obj[prop].push(color);
				}
			}

		}

		type.method(obj);
	}


	_drawObjects(buffer,in_view){
		//dr
		this.images.globals[0]=this.offset[0];
		this.images.globals[1]=this.offset[1]
		this.images.globals[2]=this.x_scale;
		this.images.globals[3]=this.y_scale;
		if (this.images.display_as_image){
			if (this.loading_image){
			this.__drawImages(this.images.props);
			}
		}
		let data_source = "data";
		if (this.config.in_view_only){
			data_source=in_view?"data_in_view":"data";
		}
		for (var i in this.object_types){
			var type =this.object_types[i];
			if (type[data_source].count===0){
				continue;
			}

			if (buffer){
				buffer=this.pickbuffer;
			}
			else{
				buffer=null;
			}
			//don't draw images unless buffer
			if (!(buffer) && i==4 && this.images.display_as_image){
				continue
			}
			var obj={
			   stage_width:this.width,
			   stage_height:this.height,
			   x_scale:this.x_scale,
			   y_scale:this.y_scale,
			   globals:this.images.globals,
			   buffer:buffer,
			   offset:this.offset,
			   count:type[data_source].count * type.vertices,
			   primitive:type.primitive,
			   is_buffer:buffer?1:0,
			   universal_radius:this.universal_circle_radius


			};
			//dummy values
			if (i==4){
				obj.w_h=[0,0];
				obj.x_y=[0,0];
				obj.text=this.loading_image;
				obj.is_buffer=1;
				
				
			

			}
			if (i==5){
				obj.w_h=this.imagetiles.w_h;
				obj.text0=this.imagetiles.text0;
				obj.text1=this.imagetiles.text1;
				obj.text2=this.imagetiles.text2;
				obj.text3=this.imagetiles.text3;
				obj.text4=this.imagetiles.text4;
				obj.i_w_h=this.imagetiles.i_w_h;
			}
			for (var prop in type.properties){

				if (buffer){
					if (prop==='pick_color'){
						obj['color']=type[data_source][prop];
						continue;
					}
					if (prop==='color'){
						continue;
					}
					obj[prop]=type[data_source][prop];
				}
				else{
					if (prop==='pick_color'){
						continue;
					}
					obj[prop]=type[data_source][prop];
				}
			}
			type.method(obj);
		}
	}

	filterObjects(keys,object_type){
		if (! object_type){
			object_type=0;
		}
		//this.is_filtered={};
		
		let obj_type= this.object_types[object_type];
		let vert=obj_type.vertices;
		for(let obj of this.objects){	
			let key =obj[2];
			if (this.is_hidden[key]){
				continue
			}
			let st=obj[0];
			let end= st+vert;
			let op=0.6;
			if (keys[key]){
				op=1.0;
			}
			for (let n=0;n<vert;n++){
				obj_type.data.opacity[st+n]=op;
			}
			
		}
	}


	filterImages(keys){
		let obj_type= this.object_types[4];
		for(let obj of this.objects){	
			let key =obj[2];
			if (keys[key]){
				this.images.props[obj[3]].opacity=[1.0,1.0,1.0,1.0,1.0,1.0]
			}
			else{
				//this.is_filtered[key]=true;
				this.images.props[obj[3]].opacity=[0.6,0.6,0.6,0.6,0.6,0.6];
			}
			if (this.is_hidden[key]){
				this.images.props[obj[3]].opacity=[0,0,0,0,0,0];
			}
			
		}
	}

	hideImages(keys){
		this.is_hidden={};
		let obj_type= this.object_types[4];

		for(let obj of this.objects){	
			let key =obj[2];
			if (keys[key]){
					this.images.props[obj[3]].opacity=[1.0,1.0,1.0,1.0,1.0,1.0]
				
			}
			else{
				this.is_hidden[key]=true;
				this.images.props[obj[3]].opacity=[0,0,0,0,0,0]
				
			}
		
			
		}

	}

	hideObjects(keys,object_type){
		if (! object_type){
			object_type=0;
		}
		this.is_hidden={};
		
		
		let obj_type= this.object_types[object_type];
		let vert=obj_type.vertices;
		for(let obj of this.objects){	
			let key =obj[2];
			let op=1;
			let st = obj[0];
			if (!keys[key]){
				this.is_hidden[key]=true;
				op=0;
				
			}
			for (let n=0;n<vert;n++){
				obj_type.data.opacity[st+n]=op;
			}
			
		
			
		}
	}



	initialise(func,url){
		let self = this;

		var im = new Image(128,128)
       
        im.onload=function(){
              self.loading_image=self.regl.texture({data:im,min:"linear",width:128,height:128});
              func();
        }
        im.src =url?url:"loading.png";
       
    
	}

	_getObjectAtPosition(position){
		var pixel = this.regl.read({
			x: position[0],
			y: this.height - position[1],
			width: 1,
			height: 1,
			data: new Uint8Array(6),
			framebuffer: this.pickbuffer
		});
		var index = this._getIndexFromRGB(pixel);
		if (index>0){
			return this.objects[index-1];
		}
		return null;
	}

	checkImagesLoaded(){
		let self = this;
		
		if (this.images_to_load>0){
			setTimeout(function(){
				self.refresh();
				self.checkImagesLoaded();
			},2000)
		}
	}

	_getObjectsInView(){
		if (!this.config.in_view_only){
			return;
		}
		var time = Date.now();
		var max = this.width*this.height*4;
		var pixels = this.regl.read({
			x: 0,
			y: 0,
			width:this.width,
			height: this.height,
			data: new Uint8Array(max),
			framebuffer: this.pickbuffer
		});
		var obj={};
		this._clearObjectsInView();
		for (var i=0;i<max-4;i+=4){
			var  index = pixels[i+2]*65536+pixels[i+1]*256+pixels[i];
			if (index>0){
				if(!obj[index-1]){
					obj[index-1]=true;
					this.objects_in_view++;
					if (this.objects_in_view>100000){
						for (var t in this.object_types){
							var type = this.object_types[t];
							for (var prop in type.properties){     
								type.data_in_view[prop]=(type.data[prop]);       
							}
							type.data_in_view.count=type.data.count;
						}

						this.objects_in_view=this.objects.length;
						return;

					}
				}      
			}       
		}
		 //console.log("objects in view old way "+(Date.now()-time));
		var l =  -this.offset[0];
		var r = l+(this.width/this.x_scale);
		var t =  -this.offset[1];
		var b = t+(this.height/this.y_scale);
		var old_count=0;
		var new_count=0;
		for (var i=0;i<this.objects.length;i++){
			if (obj[i]){
				var item= this.objects[i];
				var type =this.object_types[item[1]];
				new_count++;

				var st= item[0];
				var en =st+type.vertices;
				for (var prop in type.properties){    
					for (var pos=st;pos<en;pos++){
						type.data_in_view[prop].push(type.data[prop][pos]);       
					}

				}
				type.data_in_view.count++;

			}
			else{

				var item= this.objects[i];
				var type =this.object_types[item[1]];
				var act_pos =this.object_types[item[1]].data.position[item[0]];
				if (act_pos[0]>l && act_pos[0]<r && act_pos[1] >t && act_pos[1]<b){
					 old_count++;
					var st= item[0];
					var en =st+type.vertices;
					for (var prop in type.properties){    
						for (var pos=st;pos<en;pos++){
							type.data_in_view[prop].push(type.data[prop][pos]);       
						}

					}

					type.data_in_view.count++;
				}
			}





		}
		console.log("In view:"+this.objects.length+":"+new_count+":"+old_count);

		console.log("time to get objects in view "+(Date.now()-time));    
	}

	_clearObjectsInView(){
		this.objects_in_view=0;
		for (var i in this.object_types){
			var obj = this.object_types[i];

				for (var prop in obj.properties){
					obj.data_in_view[prop]=[];
				}     

			obj.data_in_view.count=0;
		}  
	}

	addHandler(handler_type,handler,name){
		var handler_dict = this.handlers[handler_type];
		if (!handler_dict){
			throw "Handler Not Supported";
		}
		if (!name){
			name = Object.keys(handler_dict).length;
		}
		handler_dict[name]=handler;
		return name;
	}

	removeHandler(handler_type,name){
		var handler_dict = this.handlers[handler_type];
		if (!handler_dict){
			throw "Handler Not Supported";
		}
		delete handler_dict['name'];


	}

	_setUpBrush(origin){
		let self = this;
		let div =$("<div>").css({position:"absolute",left:origin[0],
									top:origin[1],height:"0px",width:"0px",
									cursor:"move",
									"background-color":"gray",opacity:0.2})
								  .attr("class","wgl2d-brush")
								  .appendTo(this.div_container);

		div.draggable({
			start:function(ev,ui){
				self.brush.moving=true;
			},
			stop:function (ev,ui){
				self._brushingStopped();

			},
			containment:"parent"

		}).resizable({
			handles:"all",
			start:function(ev,ui){
				self.brush.moving=true;
			},
			stop:function (ev,ui){
				self._brushingStopped();

			}

		});
		this.brush={origin:origin,div:div,resizing:true};
	}

	clearBrush(){
		if (this.brush){
			this.brush.div.remove();
			this.brush=null;
		}
	}

	_brushingStopped(){
		this.brush.resizing=false;
		if (this.brush.div.width()<2){
			this.clearBrush();
			return;
		}
		let pos = this.brush.div.position();
		let lt =this._getActualPosition([pos.left,pos.top]);
		let br = this._getActualPosition([pos.left+this.brush.div.width(),pos.top+this.brush.div.height()]);
		let info = {x_min:lt[0],x_max:br[0],y_min:lt[1],y_max:br[1]};
		for (var i in this.handlers.brush_stopped){
			this.handlers.brush_stopped[i](info);
		}

	}


	_addHandlers(){
		var self=this;
		this.div_container.mousemove(function(e){
			if (self.brush){
				if (self.brush.resizing){
					let origin =self.brush.origin;
					let now = self._getMousePosition(e);
					let left = Math.round((origin[0]<now[0]?origin[0]:now[0]))+"px";
					let top =Math.round((origin[1]<now[1]?origin[1]:now[1]))+"px";
					let width = (Math.abs(origin[0]-now[0]))+"px";
					let height= (Math.abs(origin[1]-now[1]))+"px";
					self.brush.div.css({top:top,left:left,height:height,width:width});
					return;
				}
				else if (self.brush.moving){
					self.dragging=false;
					return;

				}
				
			}
			//is this a drag or just a click without the mouse moving
			if (self.mouse_position &&  ! self.dragging){
				var x_amount= (e.pageX-self.mouse_position[0]);
				var y_amount = (e.pageY-self.mouse_position[1]);
				if (Math.abs(x_amount) > 3 || Math.abs(y_amount)>3){
					self.dragging = true;
				}
			}

			if (self.dragging){
				var x_amount= (e.pageX-self.mouse_position[0])/self.x_scale;
				var y_amount = (e.pageY-self.mouse_position[1])/self.y_scale;
				if (self.object_clicked){

					var type =self.object_types[self.object_clicked[1]];
					var start = self.object_clicked[0];
					var end = start+type.vertices;

					for (var index=start;index<end;index++){
						type.data.position[index][0]+=x_amount;
						type.data.position[index][1]+=y_amount;
						
					}
					if (self.object_clicked[1]==4){
						let p_index = start/6;
						self.images.props[p_index].x_y=[type.data.position[start][0],type.data.position[start][1]];
					}
					if (self.object_clicked[1]==5){
						let x= type.data.position[start][0];
						let y= type.data.position[start][1]
						for (var index=start;index<end;index++){
							type.data.x_y[index][0]=x;
							type.data.x_y[index][1]=y;
						
					}
							
					}
					self.refresh(true);
					//self._drawLabels();

				}
				else{

					self.offset[0]+=x_amount;
					self.offset[1]+=y_amount;
					if (!self.loop){
				self.loop = self.regl.frame(function(){
				self._drawObjects(false);
				});
			}
					//self._drawObjects(false);  

				}
				self.mouse_position[1]=e.pageY;
				self.mouse_position[0]=e.pageX;      
			}
			//no drag event going on call any listners if mouse over/out an object
			else{
				var position =self._getMousePosition(e);
				var obj = self._getObjectAtPosition(position);
				if (obj && !self.object_mouse_over){
					for (var i in self.handlers['object_over']){
						self.handlers.object_over[i](obj[2]);                  
					}
					self.object_mouse_over=obj;
					if (self.mouse_over_color){
						self.object_temp_color=self.getObjectColor(obj[2]);
						self.setObjectColor(obj[2],self.mouse_over_color);
						self.refresh(true);
					}
				}
				else if (!obj && self.object_mouse_over){
					for (var i in self.handlers['object_out']){
						self.handlers.object_out[i](self.object_mouse_over[2]);
					}
					if (self.mouse_over_color){
						self.setObjectColor(self.object_mouse_over[2],self.object_temp_color);
						self.refresh(true);
					}
					self.object_mouse_over=null;

				}
				//move directly from one object to another
				else if(obj && (obj[2]!==self.object_mouse_over[2])){
					for (var i in self.handlers['object_over']){    
						self.handlers.object_over[i](obj[2]);  
					}


					for (var i in self.handlers['object_out']){
						self.handlers.object_out[i](self.object_mouse_over[2]);
					}
					if (self.mouse_over_color){
						self.setObjectColor(self.object_mouse_over[2],self.object_temp_color);
						self.object_temp_color=self.getObjectColor(obj[2]);
						self.setObjectColor(obj[2],self.mouse_over_color);
						self.refresh(true);
					}
					self.object_mouse_over=obj;





				}         
			}
		});

	
		this.div_container.mouseup(function(evt){
			//just a click event - inform handlers
			if (self.config.default_brush){
				self.div_container.css("cursor","crosshair");
			}
			if (self.brush && self.brush.resizing){
				self._brushingStopped();
				return;
			}
			if (!self.dragging){
				if (self.object_clicked){
					var position =self._getMousePosition(evt);
					var obj = self._getObjectAtPosition(position);
					if (obj){
						for (var i in self.handlers.object_clicked){
							self.handlers.object_clicked[i](obj[2]);
						}  
					}
				}

			}        
			else{
				//an object has finshed its drag
				if (self.object_clicked){
					self.object_clicked=null;
					self.refresh(true);              
				}
				//update which objects are now in view
				else{
					let ret = self.getRange();
					for (var i in self.handlers.panning_stopped){
							self.handlers.panning_stopped[i](ret);
					}
					self.loop.cancel();
					self.loop=null;
					  

					self._drawPickBuffer();
					self._getObjectsInView();
					if (self.brush){
						self._brushingStopped();
					}
				   self.refresh(true);
				}
				self.dragging=false;
			}
			self.object_clicked=null;
			self.mouse_position=null;   
		});  

		this.div_container.bind('mousewheel DOMMouseScroll', function(event){
			var position =self._getActualPosition(self._getMousePosition(event));
		if (event.originalEvent.wheelDelta > 0 || event.originalEvent.detail < 0) {
				self.zoom_amount+=0.05;

		}
		else {
				self.zoom_amount-=0.05;

			}

			self.x_scale*=(1+self.zoom_amount);
			self.y_scale*=(1+self.zoom_amount);
			
			//self.images.display_as_image=self.x_scale>0.04;
			
			var new_position=self._getActualPosition(self._getMousePosition(event));
			self.offset[0]+=new_position[0]-position[0];
			self.offset[1]+=new_position[1]-position[1];
			if (!self.loop){
				self.loop = self.regl.frame(function(){
				self._drawObjects(false);
				});
			}


			
			//clear the timeout user has not finished zooming
			clearTimeout($.data(this, 'timer'));
			//when user finishes call the esxpensive methods;
			$.data(this, 'timer', setTimeout(function() {
				self.zoom_amount=0;
				self.loop.cancel();
				self.loop=null;
				self._drawPickBuffer(false);
				self._getObjectsInView();
				if (self.brush){

				}
				let ret = self.getRange();
				for (let name in self.handlers.zoom_stopped){	
					self.handlers.zoom_stopped[name](ret);
				}

				self.refresh(true);
			}, 350));

		});
		this.div_container.mousedown(function (evt){
			if (evt.which===3){
				//add right click behaviour
			}
			//create brush
			if ((self.config.default_brush && !(evt.shiftKey)) || (!(self.config.default_brush)&&evt.shiftKey)){
				let t = $(evt.target)
				if(t.hasClass("wgl2d-brush") || t.hasClass("ui-resizable-handle")){
					return;
				}
				if (self.brush){
					self.clearBrush();
				}
				let origin =self._getMousePosition(evt);
				self._setUpBrush(origin);
				return;
				
			}
			if (evt.shiftKey){
				self.div_container.css("cursor","move");
			}
			//get mouse position and work out if an object was clicked
			var position =self._getMousePosition(evt);
			self.mouse_position= [evt.pageX, evt.pageY];
			var obj = self._getObjectAtPosition(position);
			
			if (obj && self.config.allow_object_drag){
				self.object_clicked= obj;
			}

		});

	}


	_initDrawMethods(){
		var self = this;

		//loading images
		


		this.__drawCircles = this.regl({
			frag: 
				 'precision highp float;\n\
			varying vec3 fragColor;\n\
			varying float op;\n\
			varying float s_angle;\n\
			varying float e_angle;\n\
			void main(){\n\
							float r = 0.0;\n\
							vec2 cxy = 2.0 * gl_PointCoord - 1.0;\n\
							r = dot(cxy, cxy);\n\
							if (r > 1.0) {\n\
								discard;\n\
								return;\n\
							}\n\
							else{\n\
								if (s_angle != 10.0){\n\
									float angle=0.0;\n\
									angle =atan(cxy[1],cxy[0]);\n\
									if (angle>s_angle && angle < e_angle){\n\
										if(r>0.75){\n\
											gl_FragColor=vec4(0.1,0.1,0.1,op);\n\
										}\n\
										else{\n\
											gl_FragColor = vec4(fragColor,op);\n\
										}\n\
									}\n\
									else{\n\
										discard;\n\
									}\n\
								}\n\
								else{\n\
									if(r>0.75){\n\
										gl_FragColor=vec4(0.1,0.1,0.1,op);\n\
									}\n\
									else{\n\
										gl_FragColor = vec4(fragColor,op);\n\
									}\n\
								}\n\
							}\n\
					}\n'

					,
			vert: 
			'attribute vec2 position;\n\
			attribute vec3 color;\n\
			attribute float opacity;\n\
			attribute mat4 segments1;\n\
			varying vec3 fragColor;\n\
			varying float op;\n\
			attribute float start_angle;\n\
			varying float s_angle;\n\
			varying float e_angle;\n\
			attribute float end_angle;\n\
			attribute float radius;\n\
			uniform float x_scale;\n\
			uniform float y_scale;\n\
			uniform vec2 offset;\n\
			uniform float stage_height;\n\
			uniform float stage_width;\n\
			uniform float universal_radius;\n\
			vec2 normalizeCoords(vec2 position){\n\
				float x = (position[0]+offset[0])*x_scale;\n\
				float y = (position[1]+offset[1])*y_scale;\n\
				return vec2(2.0 * ((x / stage_width) - 0.5),-(2.0 * ((y / stage_height) - 0.5)));\n\
			}\n\
			void main() {\n\
			   if (opacity==0.0){\n\
			         return;\n\
				}\n\
				float r=radius;\n\
				if (universal_radius!=0.0){\n\
					r=universal_radius;\n\
				}\n\
				gl_PointSize = r*x_scale;\n\
				fragColor = color;\n\
				op=opacity;\n\
				s_angle=start_angle;\n\
				e_angle = end_angle;\n\
				vec2 real_position = normalizeCoords(position);\n\
				gl_Position = vec4(real_position, 0.0, 1.0);\n\
			}\n'
			,

			attributes: {
				position: self.regl.prop('position'),
				color: self.regl.prop('color'),
				radius:self.regl.prop('radius'),
				start_angle:self.regl.prop('start_angle'),
				end_angle:self.regl.prop("end_angle"),
				opacity:self.regl.prop("opacity")

			},

		

			uniforms: {
				x_scale:self.regl.prop('x_scale'),
				y_scale:self.regl.prop('y_scale'),
				stage_width: self.regl.prop('stage_width'),
				stage_height: self.regl.prop('stage_height'),
				offset:self.regl.prop("offset"),
				universal_radius:self.regl.prop("universal_radius")
			},

			count:  self.regl.prop('count'),
			primitive: self.regl.prop('primitive'),
					framebuffer:self.regl.prop("buffer")
		});
		this.object_types[0]['method']=this.__drawCircles;


		this.__drawLines = this.regl({

				// fragment shader
				frag: ' precision highp float;\n\
						varying vec3 fragColor;\n\
						void main () {\n\
							 gl_FragColor = vec4(fragColor,1);\n\
						}\n',


				vert: '\
						attribute vec2 position;\n\
						attribute vec3 color;\n\
						uniform float x_scale;\n\
						uniform float y_scale;\n\
						uniform vec2 offset;\n\
						uniform float stage_height;\n\
						uniform float stage_width;\n\
						varying vec3 fragColor;\n\
						vec2 normalizeCoords(vec2 position){\n\
							float x = (position[0]+offset[0])*x_scale;\n\
							float y = (position[1]+offset[1])*y_scale;\n\
				return vec2(2.0 * ((x / stage_width) - 0.5),-(2.0 * ((y / stage_height) - 0.5)));\n\
						}\n\
						void main () {\n\
							fragColor=color;\n\
							vec2 norm_pos =normalizeCoords(position);\n\
							gl_Position = vec4(norm_pos, 0.0, 1.0);\n\
						}\n',


				attributes: {
					position: self.regl.prop("position"),
					color:self.regl.prop("color")


				},

				uniforms: {
					  x_scale:self.regl.prop('x_scale'),
					  y_scale:self.regl.prop('y_scale'),
					  stage_width: self.regl.prop('stage_width'),
					  stage_height: self.regl.prop('stage_height'),
					  offset:self.regl.prop("offset")
				},
				primitive:self.regl.prop("primitive"),
				framebuffer:self.regl.prop("buffer"),
				count:self.regl.prop("count")



			});
		this.object_types[1]['method']=this.__drawLines;
		this.object_types[2]['method']=this.__drawLines;
		this.__drawSquares = this.regl({
			frag: 
				 `precision highp float;
					varying vec3 fragColor;
					varying float r_clip;
					varying float b_clip;
					uniform int is_buffer;
			void main(){
						if (gl_PointCoord[0]>=r_clip || gl_PointCoord[1]>b_clip){
							discard;
							return;
						}
						//float r_border=b_clip*0.02;
						//float b_border=b_clip*0.02;
						//if (is_buffer==0  && (gl_PointCoord[0]<r_border || gl_PointCoord[0]>r_clip-r_border || gl_PointCoord[1]<b_border || gl_PointCoord[1]>b_clip-b_border)){
						//	gl_FragColor = vec4(0.1,0.1,0.1,1);
						//}
						//else{
							gl_FragColor = vec4(fragColor,1);
						//}
					}

					`,
			vert: 
			'attribute vec2 position;\n\
					attribute float side_length;\n\
					attribute vec3 color;\n\
					attribute float right_clip;\n\
					attribute float bottom_clip;\n\
					varying float r_clip;\n\
					varying float b_clip;\n\
					uniform float x_scale;\n\
					uniform float y_scale;\n\
					uniform vec2 offset;\n\
					uniform float stage_height;\n\
					uniform float stage_width;\n\
					varying vec3 fragColor;\n\
			vec2 normalizeCoords(vec2 position){\n\
							float x = (position[0]+offset[0])*x_scale;\n\
							float y = (position[1]+offset[1])*y_scale;\n\
				return vec2(2.0 * ((x / stage_width) - 0.5),-(2.0 * ((y / stage_height) - 0.5)));\n\
					}\n\
			void main() {\n\
				gl_PointSize = side_length*x_scale;\n\
							fragColor = color;\n\
							r_clip=right_clip;\n\
							b_clip=bottom_clip;\n\
							vec2 real_position = normalizeCoords(position);\n\
							gl_Position = vec4(real_position, 0.0, 1.0);\n\
			}\n'
			,

			attributes: {
				position: self.regl.prop('position'),
				color: self.regl.prop('color'),
							side_length:self.regl.prop('side_length'),
							right_clip:self.regl.prop("right_clip"),
							bottom_clip:self.regl.prop("bottom_clip")

			},

			uniforms: {
							  x_scale:self.regl.prop('x_scale'),
							  y_scale:self.regl.prop('y_scale'),
							  stage_width: self.regl.prop('stage_width'),
							  stage_height: self.regl.prop('stage_height'),
							  offset:self.regl.prop("offset"),
							  is_buffer:self.regl.prop("is_buffer")
						  },

			count:  self.regl.prop('count'),
			primitive: self.regl.prop('primitive'),
					framebuffer:self.regl.prop("buffer")
		});
		this.object_types[3]['method']=this.__drawSquares;

		this.__drawImages = this.regl({
			frag: `
				precision mediump float;
				uniform sampler2D text;
				varying vec2 uv;
				varying vec3 fragColor;
				varying float is_buff;
				varying float op;
				void main () {
					if (is_buff==0.0){
						gl_FragColor = vec4(fragColor,op)*texture2D(text, uv);
					}
					else{
						gl_FragColor=vec4(fragColor,1.0);
					}
				}`,

 			vert: `
				precision mediump float;
				attribute vec2 position;
				attribute vec3 color;
				attribute float opacity;
				uniform vec2 x_y;
				uniform vec2 w_h;
				uniform float stage_height;
				uniform float stage_width;
				uniform vec4 globals;
				uniform float is_buffer;


				varying vec2 uv;
				varying vec3 fragColor;
				varying float is_buff;
				varying float op;


			
				
				vec2 normalizeCoords(vec2 pos){
					float x = (pos[0]+globals[0])*globals[2];
					float y = (pos[1]+globals[1])*globals[3];
					return vec2(2.0 * ((x / stage_width) - 0.5),-(2.0 * ((y / stage_height) - 0.5)));
				}

				void main () {
					if (opacity==0.0){
						return;
					}
					op=opacity;
					vec2 middle = vec2(0.5,0.5)*w_h;
					vec2 n_position=position;// - middle;
					vec2 n_x_y= x_y;// - middle;

					vec2 new_pos=normalizeCoords(n_position);
					is_buff=is_buffer;
					fragColor = color;
				

					if (is_buffer==0.0){

						float x_factor = 1.0/(((w_h[0]*globals[2])/stage_width)*2.0);
						float y_factor = 1.0/(((w_h[1]*globals[3])/stage_height)*2.0);
					

						float x_offset=(((n_x_y[0]+globals[0])*globals[2])/stage_width)*2.0*x_factor;
						float y_offset=(((n_x_y[1]+globals[1])*globals[3])/stage_height)*2.0*y_factor;
						uv = vec2((new_pos[0]*x_factor)+x_factor-x_offset,-(new_pos[1]*y_factor)+y_factor-y_offset);

					}
					
					

					
					
					gl_Position = vec4(new_pos, 0, 1);

				}`,

			attributes: {
    			position:self.regl.prop("position"),
    			color:self.regl.prop("color"),
    			opacity:self.regl.prop("opacity")
   			},

  			uniforms: {
    			stage_height:self.regl.context("viewportHeight"),
    			stage_width:self.regl.context("viewportWidth"),
    			w_h:self.regl.prop("w_h"),
    			x_y:self.regl.prop("x_y"),
    			text:self.regl.prop("text"),
    			globals:self.regl.prop("globals"),
				is_buffer:self.regl.prop("is_buffer"),

  			},

  			count: self.regl.prop("count"),
  			framebuffer:self.regl.prop("buffer")
		});

		this.object_types[4]['method']=this.__drawImages;
	


		this.__drawImagetiles = this.regl({
			frag: `
				precision mediump float;
				uniform sampler2D text0;
				uniform sampler2D text1;
				uniform sampler2D text2;
				uniform sampler2D text3;
				uniform sampler2D text4;
				varying vec2 uv;
				varying vec3 fragColor;
				varying float is_buff;
				varying float op;
				varying float sheet;
				void main () {
					if (is_buff==0.0){
						if (sheet==0.0){
							gl_FragColor = vec4(fragColor,op)*texture2D(text0, uv);
						}
						else if (sheet==1.0){
							gl_FragColor = vec4(fragColor,op)*texture2D(text1, uv);
						}
						else if (sheet==2.0){
							gl_FragColor = vec4(fragColor,op)*texture2D(text2, uv);
						}
						else if (sheet==3.0){
							gl_FragColor = vec4(fragColor,op)*texture2D(text3, uv);
						}
						else if (sheet==4.0){
							gl_FragColor = vec4(fragColor,op)*texture2D(text3, uv);
						}
					}
					else{
						gl_FragColor=vec4(fragColor,1.0);
					}
				}`,

 			vert: `
				precision mediump float;
				attribute vec2 position;
				attribute vec3 color;
				attribute float opacity;
				attribute vec2 x_y;
				attribute vec3 c_r;
				uniform vec2 w_h;
				uniform vec2 i_w_h;
				uniform float stage_height;
				uniform float stage_width;
				uniform float is_buffer;
				uniform float x_scale;
				uniform float y_scale;
				uniform vec2 offset;


				varying vec2 uv;
				varying vec3 fragColor;
				varying float is_buff;
				varying float op;
				varying float sheet;


			
				
				vec2 normalizeCoords(vec2 pos){
					float x = (pos[0]+offset[0])*x_scale;
					float y = (pos[1]+offset[1])*y_scale;
					return vec2(2.0 * ((x / stage_width) - 0.5),-(2.0 * ((y / stage_height) - 0.5)));
				}

				void main () {
					if (opacity==0.0){
						return;
					}
					op=opacity;
					vec2 middle = vec2(0.5,0.5)*i_w_h;
					vec2 n_position=position - middle;
					vec2 n_x_y = x_y - (vec2(c_r[1],c_r[2])*i_w_h) - middle;
					//vec2 n_x_y= x_y -middle

					vec2 new_pos=normalizeCoords(n_position);
					is_buff=is_buffer;
					fragColor = color;
					sheet=c_r[0];
				

					if (is_buffer==0.0){


						float x_factor = 1.0/(((w_h[0]*x_scale)/stage_width)*2.0);
						float y_factor = 1.0/(((w_h[1]*y_scale)/stage_height)*2.0);
					

						float x_offset=(((n_x_y[0]+offset[0])*x_scale)/stage_width)*2.0*x_factor;
						float y_offset=(((n_x_y[1]+offset[1])*y_scale)/stage_height)*2.0*y_factor;
						uv = vec2((new_pos[0]*x_factor)+x_factor-x_offset,-(new_pos[1]*y_factor)+y_factor-y_offset);

					}
					
					

					
					
					gl_Position = vec4(new_pos, 0, 1);

				}`,

			attributes: {
    			position:self.regl.prop("position"),
    			color:self.regl.prop("color"),
    			opacity:self.regl.prop("opacity"),
    			x_y:self.regl.prop("x_y"),
    			c_r:self.regl.prop("c_r")
   			},

  			uniforms: {
    			stage_height:self.regl.context("viewportHeight"),
    			stage_width:self.regl.context("viewportWidth"),
    			w_h:self.regl.prop("w_h"),
    			sprite_dim:self.regl.prop("sprite_dim"),
    			text0:self.regl.prop("text0"),
    			text1:self.regl.prop("text1"),
    			text2:self.regl.prop("text2"),
    			text3:self.regl.prop("text3"),
    			text3:self.regl.prop("text3"),
				is_buffer:self.regl.prop("is_buffer"),
				x_scale:self.regl.prop("x_scale"),
				y_scale:self.regl.prop("y_scale"),
				offset:self.regl.prop("offset"),
				i_w_h:self.regl.prop("i_w_h")

  			},

  			count: self.regl.prop("count"),
  			framebuffer:self.regl.prop("buffer")
		});

		this.object_types[5]['method']=this.__drawImagetiles;
	}
	
}


export {WGL2DI};



