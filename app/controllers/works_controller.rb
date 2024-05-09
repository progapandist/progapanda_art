class WorksController < ApplicationController
  def index
    @work = Work.all.sample
  end

  def show
  end
end
