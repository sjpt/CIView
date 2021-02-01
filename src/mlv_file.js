import {pako} from "./vendor/pako_inflate.js";


class MLVFileChooser{
    constructor(callback,config){
        if (!config){
            config={};
        }
        this.fileInput = $("<input>").attr("type","file").hide();
        this.callback=callback;
        if (config.filter){
            this.fileInput.attr("accept",filter);
        }
        $('<body>').append(this.fileInput);
        this.fileInput.change((event)=>{
            let f = new MLVFile(event.target.files[0],config);
            f.readHeader(this.callback);
          
        });
    }
    
    setFilter(filter){
        this.fileInput.attr("accept", filter);
    }
    
    showOpenDialog(callback){
        if (callback){
            this.callback=callback;
        }
        this.fileInput.trigger("click");
    }
    destroy(){
        this.fileinput.remove();
    }
}




function mlvUploadFile(file,url,data,callback){
    let xhr = new XMLHttpRequest();
    let fd = new FormData();
    xhr.responseType="json";
    xhr.open("POST", url, true);
    xhr.onreadystatechange = function() {
        if (xhr.readyState == 4 && xhr.status == 200) {
            // Every thing ok, file uploaded
            callback(xhr.response);
        }
    };
    fd.append("upload_file", file);
    fd.append("data",JSON.stringify(data));
    xhr.send(fd);   
}



class MLVFile{
    constructor(file,config){
        this.file=file;
        if (!config){
            config={}
        }
        this.config=config;
        this.is_gz=file.name.endsWith(".gz");
        this.delimiter="\t";
        this.errors=[];
        this.comment_symbol="#";
    }
    readHeader(callback){
        let blob = this.file.slice(0,10000);
        let reader = new FileReader();
        reader.onloadend= (evt)=>{
            if (evt.target.readyState == FileReader.DONE){
                try{
                    let header = evt.target.result;
                    if (this.is_gz){
                        header = pako.inflate(evt.target.result,{to:"string"})
                    }
                    let lines =header.split(/\r?\n/);
                    this.getHeaders(lines);
               
                }catch(e){
                    console.log(e);
                    this.errors.push("Unable to read file");
                }
                callback(this);         
            }
        };
        reader.readAsBinaryString(blob) 
    }

    readAsText(callback){
        let reader =new FileReader();
        reader.onload=function(){
            callback(reader.result.split(/\r?\n/));
        }
        reader.readAsText(this.file);
    }

    getHeaders(lines,callback){
        let header_line=0;
        for (let line of lines){
            if (line.startsWith(this.comment_symbol) || !line){
                header_line++;
            }
            else{
                break;
            }
        }
        let headers =replaceAll(lines[header_line],'"');
        let arr1=headers.split("\t");
        let arr2=headers.split(",");
        this.delimiter=",";
        headers=arr2;
        if (arr1.length>arr2.length){
            this.delimiter="\t";
            headers=arr1;
        }
       
     
        let first_line_values = lines[header_line+1].split(this.delimiter);

        //proobably niche case first line missing header
        if (this.config.first_header_missing){
                headers.unshift("count");
        }
        if (headers.length !== first_line_values.length){    
            this.errors.push("Rows contains unequal numbers of columns");
            return;
        }
        //read lines and assign types
        let types=[];
        for (let i=0;i<headers.length;i++){
            types.push("integer");
        }

        for (let n=1;n<10;n++){
            let line =  lines[header_line+n];
            if (line === undefined){
                break;
            }
            let values =line.split(this.delimiter);        
            for (let i=0;i<values.length;i++){
                if (types[i]==="text"){
                    continue;
                }
                let type = getType(replaceAll(values[i],'"'));
               
                if (type==="text"){
                    types[i]="text";
                    continue;
                }
                if (types[i]==="double"){
                    continue;
                }
                if (type === "double"){
                    types[i]="double";
                }
          
            }
        }
        this.has_headers=false;

        //if 'headers' are of different type probably are headers
        for (let i =0;i<headers.length;i++){
            let h_type= getType(headers[i]);
            if ( h_type==="text" && h_type !== types[i]){
                this.has_headers=true;
                break;
            }
        }
        
      
        this.fields= [];
        let count=0;
        for (let val of headers){
            this.fields.push({"name":val,"type":types[count],"position":count});
            count++;
        }
        this.first_line_values=first_line_values;
    }
 
}

function getType(val){
    let type ="integer";
    if (isNaN(val)){
        type="text";
    }
    else if(val.includes(".")){
           type="double"
    }
    return type;

}

function replaceAll(str,rep){
    while (str.indexOf(rep)!==-1){
        str= str.replace(rep,"")
    }
    return str;
}


class SparseMatrixUploadDialog{
    constructor(callback,div){
        let self = this;
        this.callback=callback;

        if (!div){
            this.div = $("<div>").dialog({
            close: ()=>{
                this.div.dialog("destroy").remove();
            },
            width:370,
            title:"Upload File"
	        }).dialogFix();
        }
        else{
            this.div=div;
        }
        this.file_chooser= new MLVFileChooser(function(file){
            self.processFile(file)
        });

        this.addSection("columns","Choose Columns");
        this.addSection("rows","Choose Rows");
        this.addSection("file","Choose Matrix")
 

    }

    addSection(type,text){
        let self=this;
       let div = $("<div>").css({"margin-right":"10px","font-size":"14px","height":"40px"}).text(text).appendTo(this.div);
       $("<button>").attr({"class":"btn btn-sm btn-secondary"}).css({float:"right","padding":"3px","font-size":"12px"}).text("Choose").click(function(e){
           self.current_type=type;
            self.file_chooser.showOpenDialog();
        }).appendTo(div);
        this[type+"_info_div"]=div;

    }

   
    isReady(){
        if (this.rows && this.columns && this.file){
            this.callback({
                rows:this.rows,
                columns:this.columns,
                file:this.file
            })
        }
    }

    processFile(file){
        let self = this;
        let type = this.current_type
        if (type==="rows" || type==="columns"){
            file.readAsText(function(data){
                self[type]=data;
                let info = data[0]+",..("+data.length+")";
                self[type+"_info_div"].append("<br><span style='font-size:12px'>"+info+"<span>");
                self.isReady();
            });
        }
        else{
            this.file=file;
             self[type+"_info_div"].append("<br><span style='font-size:12px'>"+file.file.name+"<span>");
            this.isReady();

        }

    }


}

class MLVFileUploadDialog{
    constructor(config){
        if (!config){
            config={};
        }
        this.config=config;
        this.div = $("<div>").dialog({
            close: ()=>{
                this.div.dialog("destroy").remove();
            },
            width:370,
            title:"Upload File"
	   }).dialogFix();
        this.file_chooser= new MLVFileChooser(function(file){
            self.displayFileInfo(file)
        },config);
        let choose_div = $("<div>").appendTo(this.div);
        this.name_div = $("<span>").css({"margin-right":"10px","font-size":"16px"}).text("No File Chosen").appendTo(choose_div);
        let but  = $("<button>").attr({"class":"btn btn-sm btn-secondary","id":"file-choose-button"}).css({float:"right"}).text("Choose").click(function(e){
            self.file_chooser.showOpenDialog();
        }).appendTo(choose_div);
       
        let self = this;
        this.div.append($("<label>Fields:</label>").css({"font-weight":"bold"}));
        this.fields_div=$("<div>").css({"height":"150px","overflow-y":"auto","margin-bottom":"4px"}).attr({id:"fields-header-div"}).appendTo(this.div);
        this.has_header_check= $("<input>").attr({"type":"checkbox","checked":false}).click(function(e){
            self._changeHeaders();
        }).appendTo(this.div);
        this.div.append("<span>Has Headers</span>");
        let upload_text = this.config.button_text?this.config.button_text:"Upload"
        this.upload_but = $("<button>").attr({"class":"btn btn-sm btn-primary",id:"file-upload-button"}).text(upload_text)
        .attr("disabled",true).css("float","right").click(function(e){
            self._uploadFile();
        }).appendTo(this.div);
        this.has_headers=this.config.has_headers;
        if (this.config.demo_data){
            this.setupDemo(this.config.demo_data);
        }

    }

  

    remove(){
	   this.div.dialog("close");
    }

    _changeHeaders(){
        this.has_headers= this.has_header_check.prop("checked");
        let self = this;
        
        this.div.find(".field-name-input").each(function(i){
                let field = $(this).data("field");
                let pos = $(this).data("position");
                if (self.config.compulsory_fields && self.config.compulsory_fields[pos]){
                     $(this).val(field.name);
                     $(this).attr("disable",true);
                }
                else if (!self.has_headers){
                    $(this).val("Enter Column Name ("+field.name+")")
                }
                else{
                   $(this).val(field.name);
                }
        });
        
    }

    setUploadCallback(upload_callback){
        this.upload_callback=upload_callback;
    }

    _addHeader(field,n){
            let div = $("<div>").attr("class","field-div");
            let span = $("<span>").text(n+".").width(20).css("display","inline-block");
            div.append(span);
            let name = this.has_headers?field.name:"Enter Column Name ("+field.name+")";
            if (this.config.compulsory_fields && this.config.compulsory_fields[n]){
                if (this.config.compulsory_fields[n].datatype==="text"){
                    field.type="text";
                }
            }
            if (this.config.compulsory_fields && this.config.compulsory_fields[n]){
                name=field.name;
            }
                        let select = $("<select><option>text</option><option>integer</option><option>double</option></select>");
                        if (field.error){
                            select.css("border","solid 1px red");
                        }
            select.val(field.type);
            let input = $("<input>").css({"display":"inline","width":"50%","margin-right":"5px"}).attr("class","field-name-input").val(name).data({"position":n,"field":field,"select":select});
            div.append(input);
          

            div.append(select);
              if (this.config.compulsory_fields && this.config.compulsory_fields[n]){
                input.attr("disabled",true);
                select.attr("disabled",true);
            }
            this.fields_div.append(div);
            if (!this.config.compulsory_fields || (!this.config.compulsory_fields[n])){
                let delete_but=$("<i class='fa fa-trash'></i>").data("div",div).click(function(e){
                    let index = $(this).data("index");
                    $(this).data("div").remove();
                });
                div.append(delete_but);
            }
          

    }

    _uploadFile(){
        if (this.upload_callback){
            this.upload_callback(this.file,this.getFields(),this.has_headers,this.delimiter);
        }
    }

    getFields(){
        let fields = [];
        this.div.find(".field-name-input").each(function(i){
            let el =$(this);
            let name = el.val()
            let pos = el.data("position");
            let datatype = el.data("select").val();
            fields.push({name:name,position:pos,datatype:datatype});
        });
        return fields;
    }

    setupDemo(data){
         this.name_div.text(data.file_name);
         let index=1;
         $("#file-choose-button").attr("disabled",true);
          for (let field of data.fields){
            this._addHeader(field,index);
            index++;
          }
          this.upload_but.attr("disabled",false)

    }

    displayFileInfo(file){
        this.fields_div.empty();
        if (file.errors.length !==0){
            for (let error of file.errors){
                this.fields_div.append("<p>"+error+"</p>");
            }
            return;
        }
        this.file=file.file;
       
        let error=false;
        if (this.config.compulsory_fields){
            let c = this.config.compulsory_fields;
          
            for (let index in c){
                let c_field= c[index];
                let f_field=file.fields[index-1];
                if (!f_field){
                    this.fields_div.append("<p>Not Enough Columns</p>");
                    error=true;
                    break;
                }
                f_field.name=c_field.label;
                if (c_field.datatype!=="text" && (f_field.type !== c_field.datatype)){
                    this.fields_div.append("<p>Compulsory field "+c_field.label + " column " + index + " contains the wrong datatype</p>");
                    f_field.error=true;
                    error=true;
                }
            }
            
              
            //crude way to work out if file has headers
          
        }
        this.headers=file.fields;
        this.has_headers=file.has_headers;
        this.has_header_check.prop("checked",this.has_headers);
        this.delimiter=file.delimiter;

        this.name_div.text(file.file.name);
        let index=1;
        for (let field of file.fields){
            this._addHeader(field,index);
            index++;
        }
        if (!error){
            this.upload_but.attr("disabled",false);
        }
        $("#file-choose-button").text("Change");
    }
}

export {MLVFileChooser,MLVFileUploadDialog,mlvUploadFile,SparseMatrixUploadDialog};
