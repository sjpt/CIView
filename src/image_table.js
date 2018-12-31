class MLVImageTable {
    constructor(parent_div,data_view,base_url){
        this.row_first=0;
        this.row_last=139;
        this.tile_height=205;
        this.tile_width=205;
        let self =this;


        let im = new Image();
        im.src=base_url+"1.png";
        im.onload=function(e){
            self.img_width=im.width;
            self.img_height=im.height;
            self.setImageDimensions([im.width,im.height]);
            self.show();
        }
        this.base_url=base_url;
        this.parent = parent_div;
        this.selected_tiles={};
        this.margin=10;
       
        this.cache_size=5;

        this.view_port = $("<div>").height(this.parent.height()).width(this.parent.width())
                                   .css({"overflow":"auto","display":"none"});
        this.canvas = $("<div>");
        this.data_view = data_view;
        parent_div.append(this.view_port);
        this.width = this.view_port.width();
        this.height = this.view_port.height();

        this.num_per_row= Math.floor((this.width-10)/this.tile_width);
        
        //work out canvas height
     
        this.canvas.css({"position":"relative","background-color":" LightGray"}).click(function(e){
            let img =$(e.originalEvent.srcElement);
            let id= img.attr("id");
            if (!id){
                return;
            }
            let arr =id.split("-");
            if (arr[1]==="tile"){
                let range=null
                let item = self.data_view.getItemById(arr[2]);
                let index = self.data_view.getRowById(arr[2]);
                if (e.shiftKey && (self.last_index_clicked || self.last_index_clicked===0)) {
                    range=[]
                    let diff = index-self.last_index_clicked<0?-1:1;
                    let st= self.last_index_clicked+1;
                    let en =index+1;
                    if (diff===-1){
                        st=index;
                        en=self.last_index_clicked;
                    }
                    for (let i=st;i<en;i++){
                        range.push(self.data_view.getItem(i))
                    }
                    

                }
                self.listeners.image_clicked.forEach((func)=>{func(e,item,img,range)});
                self.last_index_clicked=index;
            }
            //self.mlv_iv.goToLocation(id);
          
        });
        this._setCanvasHeight();

        this.view_port.append(this.canvas).scroll(function(e){
            self._hasScrolled();
        });
        this.parent.append(this.view_port);
        let end_row = Math.floor((this.height+(this.cache_size*this.tile_height))/this.tile_height);
        this.max_difference= end_row+this.cache_size;
        this._addListeners();
        //this.render(0,end_row,true);
        this.resize_timeout=null;
        this.resize_timeout_length=50;

        this.listeners={
       		"image_clicked":new Map(),
       		"data_changed":new Map(),
       		"tagging":new Map()
       	};

       	this.highlight_colors=null;



    }

    addListener(type,func,id){
    	let listener = this.listeners[type];
    	if (!listener){
    		return null;
    	}
    	if (!id){
    		id = type+"_"+listener.size
    	}
    	listener.set(id,func);
    	return id;
    }

    removeListener(type,id){
    	let listener = this.listeners[type];
    	if (!listener){
    		return false;
    	}
    	return listener.delete(id);
    }


    
    setImageDimensions(dim){
    	this.tile_width=parseInt(dim[0])+this.margin;
        this.tile_height=parseInt(dim[1])+this.margin;
        this.t_width = parseInt(dim[0]);
        this.t_height = parseInt(dim[1]);
    }


    _addListeners(){
        let self = this;
        clearTimeout(this.resize_timeout);
        $(window).on("resize", function() {
            if (self.view_port.css("display")==="none"){
                return;
            }
             self.resize_timeout=setTimeout(()=>{
            	 
                self.show();
            },self.resize_timeout_length);
        });
        

    }
    
    resize(){
    	let self=this;
    	clearTimeout(this.resize_timeout);
    	 self.resize_timeout=setTimeout(()=>{
    		 self._resize();
             self.show();
         },self.resize_timeout_length);
    }


    getFirstTileInView(){
        let top = this.view_port.scrollTop();
        return Math.floor(top/this.tile_height)*this.num_per_row;

    }

    _setCanvasHeight(){
        let h = (Math.ceil(this.data_view.getLength()/this.num_per_row))*this.tile_height;
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
        else if (begin_row===this.row_displayed_first){
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
        
        for (let id in this.selected_tiles){
            $("#mlv-tile-"+id).addClass("mlv-tile-selected");
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

    _resize(){
        this.width = this.parent.width();
        this.height = this.parent.height();
        this.view_port.height(this.height).width(this.width);
        this.num_per_row= Math.floor((this.width-10)/this.tile_width);
    }

    _calculateTopBottomRow(first_tile_index){
        let s_top=0;
        if (first_tile_index || first_tile_index===0){
            s_top=(Math.floor(first_tile_index/(this.num_per_row+1)))*this.tile_height;
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
        return ({top:begin_row,bottom:end_row,scroll_top:s_top})    
    }

    clearHighlights(){
        this.highlight_colors=null;
        $(".mlv-tile").css("border","none");

    }

    setSelectedTiles(ids,append){
        if (!append){
            $(".mlv-highlight-tile-div").remove();
            this.selected_tiles={};
        }
        for (let id of ids){
            let tile = $("#mlv-tile-"+id);
            let highlight_div=$("<div>")
            .css({
                position:"absolute",
                top:tile.css("top"),
                left:tile.css("left")
            })
            .attr("class","mlv-highlight-tile-div")
            .height(tile.height())
            .width(tile.width());
            this.canvas.append(highlight_div)
            this.selected_tiles[id]=true;
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


    show(first_tile_id){
        this._resize();
        this._setCanvasHeight();
        let obj=this._calculateTopBottomRow(first_tile_id);
        this.view_port.show();
        this.view_port.scrollTop(obj.scroll_top);
        this.render(obj.top,obj.bottom,true);
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
            if (this.highlight_colors){
                let val =item[this.highlight_colors['field']];
                let color = this.highlight_colors.colors[val];
                if (color){
                    border= "border:4px solid "+color+";";
                }

            }
            let url = this.base_url+item.id+".png";
            let img = $("<img src='"+url+"' style='"+border+"height:"+this.t_height+"px;width:"+this.t_width+"px;position:absolute;box-sizing:border-box;left:"+left+"px"+";top:"+top+"px' class='mlv-tile mlv-tile-row-"+row+"' id='mlv-tile-"+item.id+"'>");
              
            this.canvas.append(img);
        }
    }
}


class MLVImageTableControls{
    constructor(app,div){
        this.div=div;
        this.app=app;
        let self = this;
        div.append($("<i class='fas fa-tags'></i>")
                .css({"cursor":"pointer"})
                .click(function(){
                    new TaggingDialog(self.app,{name:"tags",label:"Tags"},["Peak","Noise"]);
                 }));
        let slider = $("<div>").css({width:"250px",display:"inline-block"}).slider({
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

    _setUpListeners(){
        let self =this;
        this.app.data_view.onRowCountChanged.subscribe(function (e, args) {
            self.total_row_text.text(args.current);
        })
   
    }

}



class TaggingDialog{
    constructor(app,field,options){
        let self=this;
        this.field=field;
        this.options=options;
        this.color_pallete=["#7FFF00","#DC143C","blue"];
        this.app=app;
        this.div = $("<div>");   
        this.div.dialog({
            autoOpen: true,      
            close:function(){
                self.app.removeListener("image_clicked",self.listener);
                self.app.clearHighlights();
                $(this).dialog('destroy').remove();
                self.app.listeners.tagging.forEach((func)=>{func(false)});   
            },
            title: "Tagging",
            width:250
        });
        this.init();
        this.app.listeners.tagging.forEach((func)=>{func(true)});      
        
    }


    imageClicked(event,data,img,range){
        if (!range){
            range=[data];
        }
        let radio_button=$("input[name='tag-option-radio']:checked");
        let option = radio_button.val();
        for (let item of range){
            let im = $("#mlv-tile-"+item.id);
            if (option === "None"){
                im.css("border","none");
                delete item[this.field.name];
            }
            else{
                item[this.field.name]=option;
                let color = this.app.highlight_colors.colors[option];
                im.css("border","4px solid "+color);
            }
        }
        let field= this.field.name
        this.app.listeners.data_changed.forEach((func)=>{func(field,range)});       
    }

     
    init(){
        let self=this;
        this.options.push("None");
        let option_grouo_id= "sc-ra-name-"+this.id;
        let count=0;
        let colors= {};
        for (let option of this.options){
            let checked=(count===0)
            let div = $("<div>").height(40);
            div.append($("<input>").attr({type:"radio",value:option,checked:checked,name:"tag-option-radio"}));
            div.append("<span>"+option+"</span>");
           
            this.div.append(div);
            if (option !=="None"){
                let color_input=$("<input>").attr({type:"color","class":"tag-option-color"}).css({"display":"inline","width":"40px","float":"right"}).height(20).val(this.color_pallete[count]).appendTo(div);
                colors[option]=this.color_pallete[count];
            }
            count++;
        }
        this.app.highlight_colors={"field":this.field.name,"colors":colors};
        this.app.show();

        this.listener= this.app.addListener("image_clicked",function(event,data,img,range){
             self.imageClicked(event,data,img,range)
        })

    }   
}



export {MLVImageTable,MLVImageTableControls};