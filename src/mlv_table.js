import {SlickGrid}  from "./vendor/slick.grid.js";
import {DataView} from "./vendor/slick.dataview.js";
import {RowSelectionModel} from "./vendor/slick.rowselectionmodel.js";



class ContextMenu{
    constructor(func){
        let self=this;
        
        this.set_item_function=func;
        $("body").on("click.contextmenuhide",function(e){
            self._removeMenu()

        })

    }

    setItemFunction(func){
        this.set_item_function=func;
    }
    _removeMenu(){
        if (this.menu && this.menu.remove){
            this.menu.remove();
        }

    }

    show(data,e){
        //build menu
        this._removeMenu();
        let self =  this;
        this.menu=$("<ul>").css({position:"absolute",display:"none","z-index":1000}).appendTo($("body"));
        this.items= this.set_item_function(data);
        for (let item of this.items){
            let li = $("<li>");
            let div=$("<div>").css("hover","blue")
            .data("func",item.func)
            .text(item.text).click(function(e){
                $(this).data("func")(data);
                self._removeMenu();

            }).appendTo(li);
            li.appendTo(this.menu);
        }

        this.menu.css({top:e.clientY+"px",left:e.clientX+"px"}).menu().show();
        e.stopImmediatePropagation();

    }
}

class MLVTable{
    constructor(element_id,columns,data_view,extra_options){
        this.element_id=element_id;
        this.filters=[];
        let options = {
            enableCellNavigation: true,
            enableColumnReorder: true,
            jQueryUiStyles: false,
            multiColumnSort: true,
            enableAsyncPostRender: true,
            enableAsyncPostRenderCleanup:true,
           
        };
        for (let o in extra_options){
            options[o]=extra_options[o];
        }
        
        this.data_view=data_view?data_view:new DataView();
        

       
      
        this.grid= new SlickGrid("#"+element_id,this.data_view,columns,options);
        
        let self = this;
        this.listeners={
            "scroll_listener":[],
            "sort_listener":[],
            "row_clicked_listener":[]
        };
        this.scroll_timeout=null;
        this.scroll_timeout_length=200;
       
        this.data_view.onRowCountChanged.subscribe(function (e, args) {
            self.grid.updateRowCount();
            self.grid.render();
        });

        this.data_view.onRowsChanged.subscribe(function (e, args) {
            self.grid.invalidateRows(args.rows);
            self.grid.render();
        });
        this.grid.setSelectionModel(new RowSelectionModel());
        this._setupListeners();
        this._setupSorting();
    }


    loadData(url){
         let self = this;
        return new Promise(function(accept,reject){
           
            $.ajax({
                url:url,
                dataType:"json"
            })
            .done(function(data){
                self.data_view.setItems(data);
                self.resize();
                accept(data);
            });
        })

    }





    addListener(type,func){
        this.listeners[type].push(func);
    }

    setColumns(columns){
        for (let column of columns){
            if (column.filterable){
                this.data_view.filters.push({
                    active:false,
                    field:column.field,
                    datatype:column.datatype,
                    label:column.name,
                    operand:"=",
                    value:""
             });
             column.name="<i id='grid-filter-icon-"+column.field+"' class='fa fa-filter grid-filter-icon grid-filter-icon-off'></i>"+column.name;
            }
        }

         this.grid.setColumns(columns);
        

    }

    setValue(id,field,value){
        let item = this.data_view.getItemById(id);
        item[field] = value
        this.data_view.updateItem(id, item);
    }


    addColumn(name,label){
        let columns = this.grid.getColumns();
        let column = {id: "column"+(columns.length+1), name:label, field:name,sortable:true} 
        columns.push( column );
        this.grid.setColumns(columns);
    }
    
    getDataItem(n){
        return this.grid.getDataItem(n);
    }

    goToRow(row){
        this.grid.scrollRowIntoView(row);
    }

    getAllColumnFields(){
        let col_names=[];
        for (let col of this.grid.getColumns()){
            col_names.push(col.field)
        }
        return col_names;
    }


    getRowById(id){
        return this.grid.data_view.getRowById(id);
    }

    setDataItem(row,field,value){
        let item = this.grid.getDataItem(row);
        item[field] =value;
        this.data_view.updateItem(item.id, item);
    }

    getTopVisibleRow(){
         let vp = this.grid.getViewport();
         return vp.top;
    }

    getColumnDictionary(){
        let column_dict={};
        for (let col of this.grid.getColumns()){
            column_dict[col.field]=col.name;
        }
        return column_dict;
    }
    
    getRowNumber(){
        return this.grid.getDataLength();
    }

    getSelectedRows(){
        return this.grid.getSelectedRows();
    }

    getSelectedItems(){
        let rows = this.grid.getSelectedRows();
        let items=[];
        for (let row of rows){
            items.push(this.data_view.getItem(row));
        }
        return items;
    }
    
    setSelectedRows(rows){
        return this.grid.setSelectedRows(rows);
    }
    scrollRowIntoView(row){
        this.grid.scrollRowIntoView(row)
    }

    showFilterDialog(single_field){
        new MLVFilterDialog(this.data_view,single_field,()=>{this._updateFilterIcons()});
    }

    searchForValue(value){
        let row = this.data_view.searchData(value,this.getAllColumnFields());
        if (row !==-1){
            this.grid.scrollRowIntoView(row);
            this.grid.setSelectedRows([row]);
        }
        return row;


    }

    _updateFilterIcons(){
        for (let filter of this.data_view.filters){
            let icon = $("#grid-filter-icon-"+filter.field);
            if (filter.active){
                icon.addClass("grid-filter-icon-on");
                icon.removeClass("grid-filter-icon-off");
            }
            else{
                icon.addClass("grid-filter-icon-off");
                icon.removeClass("grid-filter-icon-on");             
            }
        }
    }

    _setupSorting(){
        let self = this;
        this.sort_functions={
            text:function sorterStringCompare(a, b) {
                    a=a.toUpperCase();
                    b=b.toUpperCase();
                    return (a === b ? 0 : (a > b ? 1 : -1));
                  },
            integer:function sorterNumeric(a, b) {
                    var x = (isNaN(a) || a[sortcol] === "" || a === null) ? -99e+10 : parseFloat(a);
                    var y = (isNaN(b) || b[sortcol] === "" || b === null) ? -99e+10 : parseFloat(b);
                    return  (x === y ? 0 : (x > y ? 1 : -1));
                    },
                  
            date:function sorterDateIso(a, b) {
                   
                        var date_a = new Date(a);
                        var date_b = new Date(b);
                        var diff = date_a.getTime() - date_b.getTime();
                        return  (diff === 0 ? 0 : (date_a > date_b ? 1 : -1));
                
   
            }

        }
        self.sort_functions.double=self.sort_functions.integer;
        this.grid.onSort.subscribe(function (e, args) {
            var cols = args.sortCols;
            self.data_view.sort(function (dataRow1, dataRow2) {
                for (var i = 0, l = cols.length; i < l; i++) {
                    var field = cols[i].sortCol.field;
                    var sign = cols[i].sortAsc ? 1 : -1;
                    var func = self.sort_functions[cols[i].sortCol.type];
                    if (!func){
                        func=self.sort_funcrions.text
                    }
                    var value1 = dataRow1[field], value2 = dataRow2[field];
                    var result =func(value1,value2) * sign;
                    if (result !== 0) {
                        return result;
                    }
                }
                return 0;
            });
            self.grid.invalidate();
            self.grid.render();
            let vp = self.grid.getViewport();
            for (let func of self.listeners['sort_listener']){
                 func(vp.top,vp.bottom);
            }
        });
    }
    
    _setupListeners(){

        let self =  this;
      
        
        this.grid.onScroll.subscribe(function(e, args){
            clearTimeout(self.scroll_timeout);
            self.scroll_timeout=setTimeout(function(){
                let vp = self.grid.getViewport();
                for (let func of self.listeners["scroll_listener"]){                 
                    func(vp.top,vp.bottom);
                }
            },
            self.scroll_timeout_length);
        });

      this.grid.onClick.subscribe(function(e, args) {
           let dataItem = args.grid.getDataItem(args.row);
           let col=args.grid.getColumns()[args.cell];
             for (let func of self.listeners["row_clicked_listener"]){                 
                    func(dataItem,col,e);
             }
      });
     
    

       this.grid.onHeaderCellRendered.subscribe(function(e, args){
            $(".grid-filter-icon").off().on("click", function(e) {
                e.stopPropagation();
               let field = $(this).attr("id").split("-")[3];
               self.showFilterDialog(field);
        });

       });
    
        
        
        window.onresize = function() {
            setTimeout(function(){
                self.grid.resizeCanvas();
            },500);
        };
              
    }
    resize(){
    	this.grid.resizeCanvas();
    }
       
}


export {MLVTable,ContextMenu};