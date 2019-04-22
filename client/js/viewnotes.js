
$(document).ready(function() {
    $.ajax({
        type : "get",
        url : '/get/notes',
        contentType : "application/json;charset=utf-8",
        dataType : 'json',
        success : function(data){
            for(var i = 0 ; i < data.length ; i++)
            {
               $('#viewnotes').append("<a href='#' data-id="+data[i].Id+" id='note-"+data[i].Id+"' class='notepads'><div class='note-doc'><p class='title'>Note"+data[i].Id+'-'+data[i].Name+"</p></div></a>");
            }
        }
    });

    $('#viewnotes').on('click','.notepads', function () {
        var noteid = $(this).attr("data-id");
        window.location.href= 'note/'+noteid;
    });
    
    $('#create_pad').on('click',function(){
    var title = $("input[name=pad_title]").val();
        $.ajax({
            type : "post",
            url : '/createnote',
            dataType : 'json',
            data :{title : title},
            success : function(data){console.log(data.noteid);
                window.location.href= 'note/'+data.noteid;
            }
        });
    });
    
    $('#sharebtn').on('click',function(){
        var usernames = $("#sharenote").val();
        var currentpath = window.location.pathname;
        var split =currentpath.split('/');
        var noteId = split[split.length-1];//$('#note-id').val()
        console.log(usernames);console.log(noteId);
        if(usernames != ""){
            $.ajax({
                type : "post",
                url : '/sharenote',
                dataType : 'json',
                data :{sharewith : usernames,noteid:noteId},
                success : function(data){//console.log(data.noteid);
                    if(data.msg=="success"){
                        $('#sharemsg').text(data.msg);
                        $("#sharemsg").fadeOut(3000);
                    }
                }
            });
        }
    });
  
    
});
