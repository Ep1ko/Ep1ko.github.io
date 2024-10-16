document.addEventListener('DOMContentLoaded', function () {
    var tickets = document.querySelectorAll('.ticket-block');

    for (var i = 0; i < tickets.length; i++) {
        tickets[i].addEventListener('click', function () {
            this.classList.toggle('expanded');
            var hiddenInfo = this.querySelector('.hidden-info');
            if(this.classList.contains('expanded')){
                hiddenInfo.style.display = "block";
            } else {
                hiddenInfo.style.display = "none";
            }
        });
    }
});
