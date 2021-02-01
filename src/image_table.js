import {ColorByDialog} from "./graphs.js";
import {MLVFilterDialog,MLVSortDialog} from "./mlv_table.js";

class MLVImageTable {
    constructor(parent_div,data_view,config){
        if (typeof parent_div === "string"){
            parent_div =$("#"+parent_div);
        }
        if (!config){
            config={};
        }
        this.row_first=0;
        this.row_last=139;
        this.tile_height=205;
        this.tile_width=205;
        let self =this;
        this.display_columns=[];
        this.flipped_tiles={};
        this.selection_mode=true;
        this.columns=[];
        this.sort_columns=[];

        config.background_color=config.background_color?config.background_color:"lightgray"
        


        let im = new Image();
        im.onload=function(e){
            self.preferred_width=self.img_width=im.width;
            self.preferred_height =self.img_height=im.height;
            if (config.initial_image_width){
                self.preferred_width=config.initial_image_width;
                self.preferred_height=Math.round((self.preferred_width/self.img_width)*self.img_height)
            }
            self._resize();
        }
        this.base_url=config.base_url;
       
     
      
        this.parent = parent_div;
        this.selected_tiles={};
        this.margin=config.margin_size?config.margin_size:10
       
        this.cache_size=5;

        this.view_port = $("<div>").height(this.parent.height()).width(this.parent.width())
                                   .css({"overflow":"auto","display":"none","background-color":config.background_color}).attr("id","vpd");
        this.canvas = $("<div>");
        this.data_view = data_view;
        parent_div.append(this.view_port);
        /*this.width = this.view_port.width();
        this.height = this.view_port.height();

        this.num_per_row= Math.floor((this.width-10)/this.tile_width);
        */
        //work out canvas height
     
        this.canvas.css({"position":"relative","background-color":config.background_color}).click(function(e){
            let img =$(e.originalEvent.srcElement);
            if (!img.attr("id")){
                img=img.parent();
            }
            let id= img.attr("id");
            if (!id){
                return;
            }
            let arr =id.split("-");
            if (arr[1]==="tile"){
                let range=null;
                let ids =null;
                let item = self.data_view.getItemById(arr[2]);
                let index = self.data_view.getRowById(arr[2]);
                if (e.shiftKey && (self.last_index_clicked || self.last_index_clicked===0)) {
                    range=[];
                    ids=[];
                    let diff = index-self.last_index_clicked<0?-1:1;
                    let st= self.last_index_clicked+1;
                    let en =index+1;
                    if (diff===-1){
                        st=index;
                        en=self.last_index_clicked;
                    }
                    for (let i=st;i<en;i++){
                        let item = self.data_view.getItem(i)
                        range.push(item);
                        ids.push(item.id);
                    }
                    ids.push(self.data_view.getItem(self.last_index_clicked).id)
                    

                }
            
                if (self.show_info_box){
                    self.showInfoBox(self.data_view.getItemById(arr[2]));
                }
        
                self.listeners.image_clicked.forEach((func)=>{func(e,item,img)});

                self.last_index_clicked=index;
                if (self.tagger && self.tagger.selected_option){
                    if (! range){
                        range=[item];
                    }
                    self.setTags(range);
                    return;
                }
                if (self.selection_mode){
                    if (!ids){
                       ids=[arr[2]]
                    }
                   
                    self.setSelectedTiles(ids,e.ctrlKey,true);
                }
          
            }
            //self.mlv_iv.goToLocation(id);
          
        }).mouseover(function(e){
             let img =$(e.originalEvent.srcElement);
             let im_id = img.attr("id");
            
             if (im_id){
                 let arr= im_id.split("-");
                 let id =arr[2];
                 let item = self.data_view.getItemById(id);
                 if (!item){
                     return;
                 }
                
                 
                 if (self.image_over){
                     //already in image
                     if (item.id === self.image_over[0].id){
                         return;
                     }
                     //move from one image to another
                     self.listeners.image_out.forEach((func)=>{func(e,self.image_over[0],self.image_over[1])});
                 }
                 self.listeners.image_over.forEach((func)=>{func(e,item,img)});
                 self.image_over=[item,img]
             }
             //mouse out
             else{
                 if (self.image_over){
                     self.listeners.image_out.forEach((func)=>{func(e,self.image_over[0],self.image_over[1])});
                 }
                 self.image_over=null;
             }

        })

       $(document).on("keydown",this.canvas,function(e){
            self.keyPressed(e);
        });

       
        this._setCanvasHeight();

        this.view_port.append(this.canvas).scroll(function(e){
            self._hasScrolled();
        });
        this.parent.append(this.view_port);
        /*let end_row = Math.floor((this.height+(this.cache_size*this.tile_height))/this.tile_height);
        this.max_difference= end_row+this.cache_size;*/
        this._addListeners();
        //this.render(0,end_row,true);
        this.resize_timeout=null;
        this.resize_timeout_length=50;

        this.listeners={
       		"image_clicked":new Map(),
       		"image_over":new Map(),
       		"image_out":new Map(),
       		"data_changed":new Map(),
       		"image_selected":new Map()
       	};

       	this.highlightcolors=null;

       	this.tag_color_palletes={};
       	this.image_suffix = config.image_suffix?config.image_suffix:".png";

       	this.show_info_box=config.show_info_box;

       	this.info_box=$("<div>").attr("class","image-table-info-box")
       	    .appendTo(this.canvas);
       	let cbtn = $("<a>X</a>").attr("class","closebtn").click(function(e){
       	    self.info_box.css("width",0);
       	    //self.info_box.hide();
       	}).appendTo(this.info_box);
       	this.info_box.append("<div class='info-text'></div>");

       	if (!config.base_url){
            this.url_field=config.url_field;
            im.src=data_view.getItems()[0][this.url_field]
        }
        else{
            let id = data_view.getItems()[0].id
            im.src=config.base_url+id+this.image_suffix;
        }

        this.dv_filter_listener= data_view.addListener("data_filtered",function(e){
            self.show();
        });
        if (config.columns){
            this.setColumns(config.columns);
        }



    }

    showInfoBox(item){
        if (this.columns.length===0){
            return;
        }
        let txt = this.info_box.find("div");
        txt.empty();
        //txt.scrollTop(0);
        for (let col of this.columns){
            if (col.not_display){
                continue;
            }
            txt.append("<span class='info-heading'>"+col.name+"</span>");
            txt.append("<span style='margin-left:5px'>"+item[col.field]+"</span>");
        }
        let s_top = (this.view_port.scrollTop()+2)+"px";
        this.info_box.css({width:200,top:s_top});
       
    }

    keyPressed(e){
           if (e.which===39 || e.which===40){
               if (this.last_index_clicked===this.data_view.getFilteredItems().length-1){
                   return;
               }
               if (this.last_index_clicked || this.last_index_clicked===0){
                   this.last_index_clicked++;
                   this.setSelectedTiles([this.data_view.getItem(this.last_index_clicked).id],false,true);
                     if (this.last_index_clicked>this.getLastTileInView()){
                        this.show(this.last_index_clicked);
                   }
               }
           }else if(e.which===37 || e.which===38){
               if (this.last_index_clicked===0){
                   return;
               }
               if (this.last_index_clicked){
                   this.last_index_clicked--;
                   this.setSelectedTiles([this.data_view.getItem(this.last_index_clicked).id],false,true)
                   if (this.last_index_clicked<this.getFirstTileInView()){
                        this.show(this.last_index_clicked);
                   }
               }
           }
          


    }

    showColorByDialog(div){
        let self=this;
        this.color_by_div=div;
        new ColorByDialog(this.columns,this.data_view.getItems(),div,
            function (color_by){
                $("#"+div+"-bar").position({"my":"left top","at":"left top","of":"#"+div})
				self.setColorBy(color_by);
				self.show(self.getFirstTileInView());
			});
    }

   showFilterDialog(single_field){
       
        new MLVFilterDialog(this.data_view,single_field,
                                ()=>{
                                    //any thing here?
                                });
   }

    showSortDialog(){
        let cols = [];
        let self = this;
        for (let col of this.columns){
            if (col.sortable){
                cols.push(col)
            }
        }
        new MLVSortDialog(cols,this.sort_columns,
        function(sort_cols){
            self.sortTable(sort_cols);
        });
    }

    sortTable(sort_cols){
        this.data_view.sortData(sort_cols);
        this.sort_cols=sort_cols;
        this.show();

    }

    taggingStarted(tagger){
        this.tagger=tagger;
        let self=this;
        if (this.color_by){
            this.temp_color_by=this.color_by
            $("#"+this.color_by_div+"-bar").hide();
        }
		this.color_by={
		    column:{
		        field:this.tagger.field
		    },
		    func:function(d){
		        return self.tagger.options[d];
		    }
		}
		this.show(this.getFirstTileInView());
    }

    tagAll(){
        let items = this.data_view.getFilteredItems();
        let option = this.tagger.selected_option;
        if (!option){
            return;
        }
        let field = this.tagger.field
        if (option==="None"){
            option=null;
        }
        for (let item of items){
            if (option){
                item[field]=option
            }
            else{
                delete item[field];
            }
        }
        this.data_view.listeners.data_changed.forEach((func)=>{func(field)});
        this.show(this.getFirstTileInView());
    }

    tagSelected(){
        let items=[];
        for (let id in this.selected_tiles){
            items.push(this.data_view.getItemById(id))
        }
        this.setTags(items);
    }

    setTags(items){
        for (let item of items){
            let tile = $("#mlv-tile-"+item.id); 
            tile.removeClass("image-table-selected");
            if (this.tagger.selected_option==="None"){
                delete item[this.tagger.field];
                tile.css("border","");
            }
            else{
                let border = "4px solid "+this.tagger.options[this.tagger.selected_option];
                item[this.tagger.field]=this.tagger.selected_option;
                tile.css("border",border);
            }
        }
        let field = this.tagger.field;
        this.data_view.listeners.data_changed.forEach((func)=>{func(field)});
    }

    deleteTag(tag){
        let items = this.data_view.getItems();
        let field = this.tagger.field;
        for (let item in items){

            if (item[field]===tag){
                delete item[field];
            }
        }

        this.show(this.getFirstTileInView());
    }

    updateTags(){
        this.show(this.getFirstTileInView());
    }


    taggingStopped(){
        delete this.tagger;
        if (this.temp_color_by){
            this.color_by=this.temp_color_by;
             $("#"+this.color_by_div+"-bar").show();
             delete this.temp_color_by;

        }
        else{
            this.color_by =null;
        }
        this.show(this.getFirstTileInView());
    }


   

    addListener(type,func,id){
    	let listener = this.listeners[type];
    	if (!listener){
    		return null;
    	}
    	if (!id){
    		id = this._getRandomString()
    	}
    	listener.set(id,func);
    	return id;
    }

    flipTileOnClick(flip){
        let self = this;
        if (flip){
            this.listeners["image_clicked"].set("__flip_tile",function(e,item,img){
                self.flipTile(img,item);
            })
        }
        else{
             this.listeners["image_clicked"].delete("__flip_tile");
        }
    }

    removeListener(type,id){
    	let listener = this.listeners[type];
    	if (!listener){
    		return false;
    	}
    	return listener.delete(id);
    }

    setImageWidth(width){
        this.setImageDimensions([width,Math.round((width/this.img_width)*this.img_height)])
    }


    
    setImageDimensions(dim,redraw){
        let ft = this.getFirstTileInView();
        if (!dim){
            dim=[this.preferred_width,this.preferred_height];
        }
        else{
            this.preferred_width=dim[0];
            this.preferred_height=dim[1];
        }
        if (this.width < this.preferred_width+(this.margin*2) && this.width !==0){
           dim[0]=this.width-(this.margin*3);
           this.num_per_row=1;
        }
        else{
            this.num_per_row= Math.ceil((this.width-this.margin)/(this.preferred_width+this.margin));
            dim[0] = Math.floor((this.width-2*this.margin)/this.num_per_row)-this.margin;

        }
        dim[1]=Math.round((dim[0]/this.preferred_width)*this.preferred_height);

       
    	this.tile_width=parseInt(dim[0])+this.margin;
        this.tile_height=parseInt(dim[1])+this.margin;
        this.t_width = parseInt(dim[0]);
        this.t_height = parseInt(dim[1]);
        let end_row = Math.floor((this.height+(this.cache_size*this.tile_height))/this.tile_height);
        this.max_difference= end_row+this.cache_size;
        if (redraw){
            this.show(ft);
        }
    }

    getInformationTile(item,columns,data){
        let si= this.t_height<this.t_width?this.t_height:this.t_width;
        let div = $("<div>").css({
            height:this.t_height,
            width:this.t_width,
            overflow:"hidden",
            "background-color":"white",
            "font-size":(si/12)+"px"

        });

        for (let col of columns){
            div.append("<label>"+col.name+"<label><br>");
            div.append(item[col.field]+"<br>")
        }
        if (data){
            div.css({
                height:data.height,
                width:data.width,
                position:"absolute",
                left:data.left,
                top:data.top
            });
            div.addClass(data.class);
            div.attr("id",data.id);
        }
        return div;
    }

    flipTile(img,data){
        let div=null;
      	if (img.parent().hasClass("flip")){
      		return;
      	}
      	if (img.hasClass("info-tile")){
      		let url = this.base_url+data.id+".png";
            div = $("<img src='"+url+"'</img>").addClass(img[0].className).removeClass("info-tile");
            delete data.__info_tile__
            delete this.flipped_tiles[data.id]


      	}
      	else{
      		div = civ.image_table.getInformationTile(data,[{name:"cpg Islands",field:"field1"},
      														{name:"Peak Width",field:"field4"}]);
      		div.addClass(img[0].className+" info-tile");
      		data.__info_tile__=true;
      		for (let id in this.flipped_tiles){
      		    let tile = $("#mlv-tile-"+id);
      		    let info = this.data_view.getItemById(id);
      		    if (tile.length===0){
      		        delete info.__info_tile__;
      		        delete this.flipped_tiles[id];
      		        continue;
      		    }
      		    this.flipTile(tile,info);
      		}
      		this.flipped_tiles[data.id]=true;


      	}
      	
      	div.attr("id",img.attr("id"));
      	MLVImageTable.flip(img,div);

    }


    _addListeners(){
        let self = this;
        clearTimeout(this.resize_timeout);
        $(window).on("resize", function() {
            if (self.view_port.css("display")==="none"){
                return;
            }
            self.resize();
        });
        

    }
    
    resize(){
    	let self=this;
    	clearTimeout(this.resize_timeout);
    	 self.resize_timeout=setTimeout(()=>{	     
    		 self._resize();
         },self.resize_timeout_length);
    }


    getFirstTileInView(){
        let top = this.view_port.scrollTop();
        return Math.floor(top/this.tile_height)*this.num_per_row;

    }

    getLastTileInView(){
        let bottom= this.view_port.scrollTop()+this.view_port.height();
        return Math.floor(bottom/this.tile_height)*this.num_per_row;
    }

    setColumns(columns){
        this.columns=[];
        for (let column of columns){
            this.columns.push({field:column.field,datatype:column.datatype,name:column.name,sortable:column.sortable});
            if (column.filterable){
                this.data_view.addFilter(column);
            }
        }
        //this.data_view.ensureIdUniqueness();
        
    }


    setColorBy(color_by){
        this.color_by=color_by;
    }

    _setCanvasHeight(){
        let h = ((Math.ceil(this.data_view.getLength()/this.num_per_row))*this.tile_height)+this.margin;
        this.canvas.height(h);
    }

    _hasScrolled(){
        clearTimeout(this.scroll_timeout);
         let height = this.view_port.height();
            let s_top = this.view_port.scrollTop();
            let begin_row = Math.floor((s_top-(this.cache_size*this.tile_height))/this.tile_height);
            let end_row = Math.floor((s_top+height+(this.cache_size*this.tile_height))/this.tile_height);
            if (begin_row<0){
                begin_row=0;
            }
            let elapse=10;
            if (Math.abs(begin_row-this.row_displayed_first)>this.max_difference){
                elapse=50;
            }
        this.scroll_timeout= setTimeout(()=>{
           this.info_box.css("width","0px")
            if (Math.abs(begin_row-this.row_displayed_first)>this.max_difference){
                 this.render(begin_row,end_row,true);
            }
            else{
                this.render(begin_row,end_row);
            }
        },elapse);
    }

    render(begin_row,end_row,all){
        
         
        if (all){
            $(".mlv-tile").remove();
            for (let n=begin_row;n<end_row;n++){
                this._addRow(n);
            }
        }
        else if (begin_row===this.row_displayed_first && begin_row!==0){
            return;
        }
        else{
            if (begin_row<this.row_displayed_first){
                for (let n=begin_row;n<this.row_displayed_first;n++){
                    this._addRow(n)     
                }
                for (let n=end_row;n<this.row_displayed_last;n++){
                    $(".mlv-tile-row-"+n).remove();
                }
            }
            else{
                for (let n=this.row_displayed_last;n<end_row;n++){
                    this._addRow(n)
                }

                for (let n=this.row_displayed_first;n<begin_row;n++){
                    $(".mlv-tile-row-"+n).remove();
                }

            }
        }
        
     
        /*$(".mlv-tile").bstooltip({
             title:function(){
                 return $(this).attr("id");
             },
             html:true,
             container:'body'
        }); 
        */
        this.row_displayed_first=begin_row;
        this.row_displayed_last=end_row;

    }

    _resize(fti){
        if (!fti){
            fti = this.getFirstTileInView();
        }
        this.width = this.parent.width();
        this.height = this.parent.height();
        this.view_port.height(this.height).width(this.width);
        this.setImageDimensions();
        this.show(fti)     
    }

    _calculateTopBottomRow(first_tile_index){
        if (!first_tile_index){
            first_tile_index=0;
        }
        let s_top=0;
        if (first_tile_index || first_tile_index===0){
            s_top=(Math.floor(first_tile_index/(this.num_per_row)))*this.tile_height;
        }
        else{
            s_top = this.view_port.scrollTop();
        }
        let height = this.view_port.height();
        let begin_row = Math.floor((s_top-(this.cache_size*this.tile_height))/this.tile_height);
        let end_row = Math.floor((s_top+height+(this.cache_size*this.tile_height))/this.tile_height);
        if (begin_row<0){
                begin_row=0;
        }
        if (begin_row==0){
            s_top=0;
        }
        return ({top:begin_row,bottom:end_row,scroll_top:s_top})    
    }



    setSelectedTiles(ids,append,propagate){
        if (!append){
            $(".image-table-selected").removeClass("image-table-selected")
            this.selected_tiles={};
        }
        for (let id of ids){
            let tile = $("#mlv-tile-"+id); 
            tile.addClass("image-table-selected");
            this.selected_tiles[id]=true;
        }
        if (propagate){
               this.listeners.image_selected.forEach((func)=>{func(ids)});
        }
          
    }

    scrollToTile(image_index,select){
        let item= this.data_view.getItem(image_index);
        let obj = this._calculateTopBottomRow(image_index);
        if (Math.abs(obj.top-this.row_displayed_first)>this.max_difference){
            this.render(obj.top,obj.bottom,true);
        }
        else{
            this.render(obj.top,obj.bottom);
        }
        this.view_port.scrollTop(obj.scroll_top);
        if (select){
            this.setSelectedTiles([item.id]);
        }
    }

     _getRandomString(len,an){
		if (!len){
			len=6;
		}
    	an = an&&an.toLowerCase();
    	let str="", i=0, min=an=="a"?10:0, max=an=="n"?10:62;
   	 	for(;i++<len;){
      		let r = Math.random()*(max-min)+min <<0;
      		str += String.fromCharCode(r+=r>9?r<36?55:61:48);
    	}
    	return str;
    }


    show(first_tile_index){
        if (!first_tile_index){
            first_tile_index=0;
        }
        this._setCanvasHeight();  
        let obj=this._calculateTopBottomRow(first_tile_index);
        this.view_port.show();
       
        this.info_box.css("top",obj.scroll_top+"px");
        this.render(obj.top,obj.bottom,true);
        this.view_port.scrollTop(obj.scroll_top);
   
    }
    hide(){
        $(".mlv-tile").remove();
        this.view_port.hide();
    }

    _addRow(row){
        let st = row*this.num_per_row;
        let en = st+this.num_per_row;
        let top = row * this.tile_height+this.margin;
        let x=0;
        for (let i=st;i<en;i++){
            let left=x*this.tile_width+this.margin;
            x++;
            let item =this.data_view.getItem(i);
            if (!item){
                return;
            }
            let border=""
            if (this.color_by){
                let color = this.color_by.func(item[this.color_by.column.field]);
                border= "border:4px solid "+color+";";
            }
            let extra_classes=""
            if (this.selected_tiles[item.id]){
               extra_classes=" image-table-selected";
            }
            let img=null
            if (!item.__info_tile__){
                let url = "";
                if (this.base_url){
                    url = this.base_url+item.id+this.image_suffix;
                }
                else{
                    url = item[this.url_field];
                }
                img = $("<img src='"+url+"' style='"+border+"height:"+this.t_height+"px;width:"+this.t_width+"px;position:absolute;box-sizing:border-box;left:"+left+"px"+";top:"+top+"px' class='mlv-tile mlv-tile-row-"+row+extra_classes+"' id='mlv-tile-"+item.id+"'>");
            }
            else{
                let data={
                    left:left+"px",
                    top:top+"px",
                    height:this.t_height+"px",
                    width:this.t_width+"px",
                    class:"info-tile mlv-tile mlv-tile-row-"+row,
                    id:"mlv-tile-"+item.id
                }
                img = this.getInformationTile(item,[{name:"ddd",field:"field1"}],data);
            }
              
            this.canvas.append(img);
        }
    }
}


class MLVImageTableControls{
    constructor(app,div){
        this.div=div.attr("class","control-bar");
        this.app=app;
        let self = this;
        let slider = $("<div>").attr({"id":"mlv-it-image-slider"})
            .css({width:"250px",display:"inline-block"}).slider({
            max:200,
            min:0,
            value:100,
            stop:function(e,ui){
                 let val =ui.value/100;
                 let width = parseInt(self.app.img_width*val);
                 let height= parseInt(self.app.img_height*val);
                 self.app.setImageDimensions([width,height]);
                 self.app.show();
            }
        }).appendTo(this.div);
        self.total_row_text=$("<span>").css({"font-weight":"bold","float":"right"}).appendTo(this.div);
        this._setUpListeners();
        this.div.children().css({"margin-left":"5px"});
    }

    addElement(element){
        this.div.append(element);
    }

    _setUpListeners(){
        let self =this;
        this.app.data_view.onRowCountChanged.subscribe(function (e, args) {
            self.total_row_text.text(args.current);
        })
   
    }

}



class TaggingDialog{
    constructor(app,field,config){
        let self=this;
        this.field=field;
        this.default_colors=["#377eb8", "#4daf4a", "#984ea3", "#ff7f00", "#ffff33", "#a65628", "#f781bf", "#999999"];
        this.charcode_to_option={};

       

        this.options={"None":""};
        if (config.options){
            for (let o in config.options){
                this.options[o]=config.options[o];
            }
        }
        

        let buttons=[{
            text:"Close",
            click:function(e){
                self.div.dialog("close");
            }

        }];
        if (config.button){
            buttons.push({
                text:config.button,

                click:function(){
                    
                    if (self.action_function){
                        self.action_function(self.getOptions());
                    }
                }
            })
        }
        this.app=app;
        this.div = $("<div>").attr("class","tagging-dialog");   
        this.div.dialog({
            autoOpen: true,      
            close:function(){
                $(window).off("keypress.mlvtagging");
                $(this).dialog('destroy').remove();
                self.app.taggingStopped(); 
                if (self.close_function){
                    self.close_function(self.getOptions());
                }
            },
            title: "Tagging",
            buttons:buttons,
            width:250
        }).dialogFix();
        this.lock_options=config.lock_options;
 
        this.init();
        $(window).on("keypress.mlvtagging",function(e){
           let radio=  self.charcode_to_option[e.keyCode];
           if (radio){
               radio.trigger("click");
               self.app.tagSelected();
           }
        })
    }

    getOptions(){
        let ret_opt={}
        for (let o in this.options){
            if (o==="None"){
                continue;
            }
            ret_opt[o]=this.options[o]
        }
        return ret_opt;
    }




  

     
    init(){
        let self=this;
        for (let option in this.options){
            if (option==="None"){
                continue;
            }    
            let div = this._getOptionDiv(option);
            this.div.append(div);     
        }

        let div = this._getOptionDiv("None");
        this.div.append(div);     
        if (!this.lock_options){
            this.div.append("<label>Add Category</label>").css("display","block");
            let t_div=$("<div>").appendTo(this.div);
            let input = $("<input>").appendTo(t_div);
            let but = $("<button>").text("Add")
            .attr("class","btn btn-sm btn-secondary")
            .css("margin-left","5px")
            .click(function(e){
                let option = input.val();
                if (!option || self.options[option]){
                    return; 
                }
                let index= Object.keys(self.options).length;
                self.options[option]=self.default_colors[index];
                input.val("");
                let div = self._getOptionDiv(option);
                div.insertBefore("#sc-ra-none-div");
                $("input[name=tag-option-radio][value='"+option+"']").prop("checked",true)
                self.selected_option=option;
                self.div.resizeDialog();
             }).appendTo(t_div);
        }
       $("<button>").text("Tag All").attr("class","btn btn-sm btn-secondary")
            .css("margin-left","5px")
            .click(function(e){
                if (!self.selected_option){
                    return;
                }
                self.app.tagAll();
            }).appendTo(this.div);     
       this.app.taggingStarted(this);
    }

    setCloseFunction(func){
        this.close_function=func;
    }
    setActionFunction(func){
        this.action_function=func;
    }

    close(){
        this.div.dialog("close");
    }





    _getOptionDiv(option){
        let self = this;
        let text=option.toLowerCase();
        let shortcut_key="";
       
       
        let div = $("<div>").height(40);
        if (option==="None"){
            div.attr({"id":"sc-ra-none-div","checked":true});
        }
        else{
            this.selected_option=option;
        }

        let radio= $("<input>").data("option",option).attr({type:"radio",value:option,name:"tag-option-radio"})
            .click(function(e){
                self.selected_option=$(this).data("option")
            });
        div.append(radio);
        for (let n=0;n<text.length;n++){
            let charcode= text.charCodeAt(n);
            if (!this.charcode_to_option[charcode]){
                this.charcode_to_option[charcode]=radio;
                shortcut_key = text.charAt(n);
                break;
            }
        }
        div.append("<span>"+option+" ("+shortcut_key+")"+"</span>");
        if (option !=="None"){
            if (!this.lock_options){
               $("<i class='fas fa-trash'></i>").data("option",option)
                .css({"font-size":"18px",cursor:"pointer",float:"right"})
                .click(function(e){
                    let o = $(this).data("option");
                    delete self.options[o];
                    if (self.selected_option===o){
                        self.selected_option=null;
                    }
                    div.remove();
                    self.app.deleteTag(o);

                }).appendTo(div);
            }
            let color_input=$("<input>").attr({type:"color","class":"tag-option-color"})
                .css({"display":"inline","width":"40px","float":"right"})
                .height(30).val(this.options[option]).appendTo(div)
                .data("option",option)
                .on("change",function(e){
                    self.options[$(this).data("option")]=$(this).val();
                    self.app.updateTags();
                });
         
           
        }
       
        return div;
    }


}

MLVImageTable.flip_count=0;

MLVImageTable.flip = function(from,to,length){
    if (!length){
        length=1.0;
    }
    let b = MLVImageTable.flip_count;
    let flipper = $("<div>").attr("class","flipper").attr("id","ee"+b);
	from.wrap(flipper);
	flipper= $("#ee"+b).append(to);

	let container =  $("<div>").attr("class","flip-container").attr("id","ff"+b);
	flipper.wrap(container);
	container=$("#ff"+b);
	MLVImageTable.flip_count++;
	from.addClass("front");
	let h = from.height();
	let w = from.width();
    to.height(h)
    	.width(w)
    	.addClass("back");
    let left = from.css("left");
    let top = from.css("top");
	let tr= "translate("+from.css("left")+","+from.css("top")+")";
    container.width(w).height(h).css({
    	position:"absolute",
    	left:left,
    	top:top
    });
    from.css("position","static");
    //flipper.append(to);
    flipper.css({
        transition:length+"s"
    });
 
    flipper.addClass("flip");
    setTimeout(function(){
    	from.remove();

    	flipper.unwrap();
    	to.unwrap();
    	to.removeClass("back");
    	to.css({
    		position:"absolute",
    		left:left,
    		top:top

    	})

    },(length*1000)+25);
}



export {MLVImageTable,MLVImageTableControls,TaggingDialog};